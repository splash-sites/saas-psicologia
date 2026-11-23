-- Cadastro do paciente (feedback da psicóloga, decidido em 2026-11-23; entrega B):
--   1. Contato de emergência (1 por paciente, opcional): nome, telefone, relação.
--   2. Responsável financeiro (quem paga, quando não é o paciente): nome, CPF,
--      telefone, relação. Serve para o recibo do Receita Saúde.
--   3. Valor da sessão (vazio = atendimento social) e forma de cobrança:
--      por sessão (padrão) ou mensal, no dia X do mês seguinte.
--
-- Mesmas três camadas do resto do cadastro: trigger padroniza (telefone e CPF
-- só dígitos, vazio vira NULL), CHECK limita formato/tamanho e o CPF do
-- responsável tem dígito verificador conferido só quando muda (como o do
-- paciente, 0025). Limites iguais a src/lib/limites.ts.
-- Aplicar no SQL Editor de produção ANTES do push. Idempotente.

alter table public.pacientes
  add column if not exists emergencia_nome text,
  add column if not exists emergencia_telefone text,
  add column if not exists emergencia_relacao text,
  add column if not exists responsavel_nome text,
  add column if not exists responsavel_cpf text,
  add column if not exists responsavel_telefone text,
  add column if not exists responsavel_relacao text,
  add column if not exists valor_sessao numeric(10, 2),
  add column if not exists cobranca text not null default 'sessao',
  add column if not exists cobranca_dia smallint not null default 10;

create or replace function public.normalizar_paciente()
returns trigger
language plpgsql
as $$
begin
  new.nome := public.nome_limpo(new.nome);
  new.email := public.email_limpo(new.email);
  new.telefone := public.telefone_limpo(new.telefone);
  new.cpf := public.digitos(new.cpf);
  new.endereco := public.texto_limpo(new.endereco);
  new.observacoes := public.texto_limpo(new.observacoes);
  new.emergencia_nome := public.nome_limpo(new.emergencia_nome);
  new.emergencia_telefone := public.telefone_limpo(new.emergencia_telefone);
  new.emergencia_relacao := public.texto_limpo(new.emergencia_relacao);
  new.responsavel_nome := public.nome_limpo(new.responsavel_nome);
  new.responsavel_cpf := public.digitos(new.responsavel_cpf);
  new.responsavel_telefone := public.telefone_limpo(new.responsavel_telefone);
  new.responsavel_relacao := public.texto_limpo(new.responsavel_relacao);
  return new;
end;
$$;

alter table public.pacientes
  drop constraint if exists pacientes_emergencia_valida,
  drop constraint if exists pacientes_responsavel_valido,
  drop constraint if exists pacientes_cobranca_valida;

alter table public.pacientes
  -- Contato de emergência: sem telefone não serve numa crise; nome e
  -- telefone vêm juntos (ou nenhum campo).
  add constraint pacientes_emergencia_valida check (
    (emergencia_nome is null) = (emergencia_telefone is null)
    and (emergencia_relacao is null or emergencia_nome is not null)
    and (emergencia_nome is null or char_length(emergencia_nome) <= 200)
    and (emergencia_telefone is null or emergencia_telefone ~ '^\d{10,11}$')
    and (emergencia_relacao is null or char_length(emergencia_relacao) <= 60)
  ),
  -- Responsável financeiro: os outros campos só existem com o nome.
  add constraint pacientes_responsavel_valido check (
    (responsavel_nome is not null
      or (responsavel_cpf is null and responsavel_telefone is null and responsavel_relacao is null))
    and (responsavel_nome is null or char_length(responsavel_nome) <= 200)
    and (responsavel_cpf is null or responsavel_cpf ~ '^\d{11}$')
    and (responsavel_telefone is null or responsavel_telefone ~ '^\d{10,11}$')
    and (responsavel_relacao is null or char_length(responsavel_relacao) <= 60)
  ),
  add constraint pacientes_cobranca_valida check (
    (valor_sessao is null or (valor_sessao > 0 and valor_sessao <= 100000))
    and cobranca in ('sessao', 'mensal')
    and cobranca_dia between 1 and 31
  );

-- CPF do responsável com dígito verificador, conferido só quando muda.
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
  if new.responsavel_cpf is not null
     and (tg_op = 'INSERT' or new.responsavel_cpf is distinct from old.responsavel_cpf)
     and not public.cpf_valido(new.responsavel_cpf) then
    raise exception 'CPF do responsável inválido'
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
