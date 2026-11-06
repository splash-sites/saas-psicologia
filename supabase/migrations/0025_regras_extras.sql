-- Três regras que o Zod já aplicava e o banco não (o banco é a última porta:
-- a chave pública do Supabase permite escrever direto no PostgREST com o
-- próprio login, sem passar pelas server actions):
--   1. lançamento pendente não tem data de pagamento;
--   2. CPF de paciente com dígito verificador válido (antes só o formato);
--   3. data de nascimento não pode ser no futuro (dia de Brasília).
--
-- No cloud, ANTES de aplicar, rode esta consulta no SQL Editor (só leitura).
-- Zero linhas = pode aplicar. Se aparecer algo, corrija e rode de novo
-- (exceção: CPF inválido antigo não impede — ver o item 3 abaixo):
--
--   select 'pagamento pendente com data de pagamento' problema, id
--   from public.pagamentos where status = 'pendente' and data_pagamento is not null
--   union all
--   select 'cpf com dígito inválido', id
--   from public.pacientes where cpf is not null and not public.cpf_valido(cpf)
--   union all
--   select 'nascimento no futuro', id
--   from public.pacientes
--   where data_nascimento > (now() at time zone 'America/Sao_Paulo')::date;
--
-- (cpf_valido só existe depois desta migration: para a consulta prévia, rode
-- antes só o bloco "create or replace function public.cpf_valido" abaixo.)

-- 1. Pendente sem data de pagamento ("marcar como pendente" já limpa a data).
alter table public.pagamentos
  add constraint pagamentos_pendente_sem_data_pagamento
    check (status = 'pago' or data_pagamento is null) not valid;
alter table public.pagamentos
  validate constraint pagamentos_pendente_sem_data_pagamento;

-- 2. CPF: 11 dígitos, não todos iguais, dígitos verificadores corretos.
-- Mesma regra de validarCpfCnpj (src/lib/assinatura/cpfCnpj.ts).
create or replace function public.cpf_valido(cpf text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  d int[];
  soma int;
  dv1 int;
  dv2 int;
begin
  if cpf is null or cpf !~ '^\d{11}$' or cpf ~ '^(\d)\1{10}$' then
    return false;
  end if;
  d := string_to_array(cpf, null)::int[];
  soma := 0;
  for i in 1..9 loop soma := soma + d[i] * (11 - i); end loop;
  dv1 := (soma * 10) % 11 % 10;
  soma := 0;
  for i in 1..10 loop soma := soma + d[i] * (12 - i); end loop;
  dv2 := (soma * 10) % 11 % 10;
  return d[10] = dv1 and d[11] = dv2;
end;
$$;

-- 3. Nascimento no futuro.
--
-- CPF e nascimento num trigger (não CHECK), conferidos só quando o campo é
-- gravado ou alterado. Motivo: o Postgres confere uma CHECK em qualquer UPDATE
-- da linha — em produção (2026-11-06) havia 1 paciente ativo de uma cliente
-- com CPF de dígito inválido, gravado antes da checagem no Zod; com CHECK, a
-- psicóloga não conseguiria nem arquivar esse paciente. Não mexemos em dado de
-- paciente sem ela; o CPF é corrigido na próxima vez que ela editar o cadastro
-- (o formulário já exige). A CHECK de formato da 0013 (11 dígitos) continua.
-- "Hoje" no nascimento também impede CHECK (precisa ser imutável).
-- O nome começa com "pacientes_validar" para rodar depois de
-- "pacientes_normalizar" (triggers rodam em ordem alfabética): CPF já em dígitos.
create or replace function public.validar_paciente()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.cpf is not null
     and (tg_op = 'INSERT' or new.cpf is distinct from old.cpf)
     and not public.cpf_valido(new.cpf) then
    raise exception 'CPF inválido'
      using errcode = 'check_violation';
  end if;
  if new.data_nascimento is not null
     and (tg_op = 'INSERT' or new.data_nascimento is distinct from old.data_nascimento)
     and new.data_nascimento > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Data de nascimento no futuro'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists pacientes_validar on public.pacientes;
create trigger pacientes_validar
  before insert or update on public.pacientes
  for each row execute function public.validar_paciente();
