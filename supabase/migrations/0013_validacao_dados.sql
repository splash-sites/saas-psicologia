-- Validação e padronização de dados no próprio banco.
--
-- O Zod das server actions não é a única porta de entrada: o client logado
-- fala direto com a API REST do Supabase (PostgREST) usando o próprio token,
-- e o RLS só decide QUEM escreve, não O QUE é escrito. Sem isto, dava pra
-- gravar paciente com nome "   ", e-mail "abc", observação de 1 MB, pagamento
-- de R$ 99 milhões etc. direto pela API.
--
-- Duas camadas, para qualquer origem (app, REST, SQL):
-- 1. Triggers BEFORE INSERT/UPDATE padronizam: tira espaço das pontas,
--    texto vazio vira NULL, e-mail em minúsculas, telefone e CPF só dígitos
--    (a máscara é só de exibição).
-- 2. CHECK constraints limitam tamanho, formato e faixa de valores.
--
-- As constraints entram NOT VALID: valem para toda escrita nova a partir daqui,
-- sem travar a migration se o banco de produção tiver algum dado antigo fora
-- do padrão. A 0014 valida as linhas existentes (rodar a consulta de
-- diagnóstico dela antes, no cloud).

-- ---------------------------------------------------------------------------
-- Funções de normalização (puras)
-- ---------------------------------------------------------------------------

-- Tira espaço/quebra de linha das pontas; vazio vira NULL.
create or replace function public.texto_limpo(t text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(t, '^\s+|\s+$', '', 'g'), '');
$$;

-- Como texto_limpo, e também junta espaços repetidos no meio (nomes).
create or replace function public.nome_limpo(t text)
returns text
language sql
immutable
as $$
  select public.texto_limpo(regexp_replace(t, '\s+', ' ', 'g'));
$$;

create or replace function public.email_limpo(t text)
returns text
language sql
immutable
as $$
  select lower(public.texto_limpo(t));
$$;

-- Só dígitos; em branco vira NULL. Campo preenchido sem dígito nenhum vira ''
-- (não NULL) de propósito, pra constraint recusar em vez de sumir com o valor.
create or replace function public.digitos(t text)
returns text
language sql
immutable
as $$
  select case
    when public.texto_limpo(t) is null then null
    else regexp_replace(t, '\D', '', 'g')
  end;
$$;

-- Como digitos(); número com DDI 55 (12-13 dígitos) vira nacional (DDD + número).
create or replace function public.telefone_limpo(t text)
returns text
language sql
immutable
as $$
  select case when d ~ '^55\d{10,11}$' then substr(d, 3) else d end
  from (select public.digitos(t) as d) s;
$$;

-- ---------------------------------------------------------------------------
-- Triggers de padronização
-- ---------------------------------------------------------------------------

create or replace function public.normalizar_psicologa()
returns trigger
language plpgsql
as $$
begin
  new.nome := coalesce(left(public.nome_limpo(new.nome), 200), new.email);
  new.email := public.email_limpo(new.email);
  new.crp := public.texto_limpo(new.crp);
  return new;
end;
$$;

create trigger psicologas_normalizar
  before insert or update on public.psicologas
  for each row execute function public.normalizar_psicologa();

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
  return new;
end;
$$;

create trigger pacientes_normalizar
  before insert or update on public.pacientes
  for each row execute function public.normalizar_paciente();

create or replace function public.normalizar_anamnese()
returns trigger
language plpgsql
as $$
begin
  new.demanda := public.texto_limpo(new.demanda);
  new.objetivos := public.texto_limpo(new.objetivos);
  new.historico := public.texto_limpo(new.historico);
  return new;
end;
$$;

create trigger anamneses_normalizar
  before insert or update on public.anamneses
  for each row execute function public.normalizar_anamnese();

create or replace function public.normalizar_consulta()
returns trigger
language plpgsql
as $$
begin
  new.observacoes := public.texto_limpo(new.observacoes);
  return new;
end;
$$;

create trigger consultas_normalizar
  before insert or update on public.consultas
  for each row execute function public.normalizar_consulta();

create or replace function public.normalizar_bloqueio()
returns trigger
language plpgsql
as $$
begin
  new.motivo := public.texto_limpo(new.motivo);
  return new;
end;
$$;

create trigger bloqueios_normalizar
  before insert or update on public.bloqueios
  for each row execute function public.normalizar_bloqueio();

-- Campos obrigatórios da evolução: só tira as pontas (sem virar NULL — a
-- constraint evolucoes_campos_minimos já recusa vazio).
create or replace function public.normalizar_evolucao()
returns trigger
language plpgsql
as $$
begin
  new.demanda := regexp_replace(new.demanda, '^\s+|\s+$', '', 'g');
  new.procedimentos := regexp_replace(new.procedimentos, '^\s+|\s+$', '', 'g');
  new.resultados := regexp_replace(new.resultados, '^\s+|\s+$', '', 'g');
  new.encaminhamentos := regexp_replace(new.encaminhamentos, '^\s+|\s+$', '', 'g');
  new.notas_privadas := public.texto_limpo(new.notas_privadas);
  new.deleted_motivo := public.texto_limpo(new.deleted_motivo);
  return new;
end;
$$;

create trigger evolucoes_normalizar
  before insert or update on public.evolucoes
  for each row execute function public.normalizar_evolucao();

create or replace function public.normalizar_pagamento()
returns trigger
language plpgsql
as $$
begin
  new.forma_pagamento := public.texto_limpo(new.forma_pagamento);
  new.observacoes := public.texto_limpo(new.observacoes);
  return new;
end;
$$;

create trigger pagamentos_normalizar
  before insert or update on public.pagamentos
  for each row execute function public.normalizar_pagamento();

create or replace function public.normalizar_preferencias_lembrete()
returns trigger
language plpgsql
as $$
begin
  new.mensagem_template := public.texto_limpo(new.mensagem_template);
  return new;
end;
$$;

create trigger preferencias_lembrete_normalizar
  before insert or update on public.preferencias_lembrete
  for each row execute function public.normalizar_preferencias_lembrete();

-- ---------------------------------------------------------------------------
-- Padroniza o que já existe (só as linhas que mudam, pra não mexer no
-- updated_at das demais). Os triggers acima rodam junto e dão o mesmo
-- resultado.
-- ---------------------------------------------------------------------------

update public.psicologas set nome = nome, email = email, crp = crp
where nome is distinct from coalesce(left(public.nome_limpo(nome), 200), email)
   or email is distinct from public.email_limpo(email)
   or crp is distinct from public.texto_limpo(crp);

-- Nome legado só com espaços ficaria NULL (e a coluna é not null): vira um
-- marcador visível em vez de abortar a migration. Escrita nova assim é recusada.
update public.pacientes set nome = coalesce(public.nome_limpo(nome), '(sem nome)')
where nome is distinct from public.nome_limpo(nome)
   or email is distinct from public.email_limpo(email)
   or telefone is distinct from public.telefone_limpo(telefone)
   or cpf is distinct from public.digitos(cpf)
   or endereco is distinct from public.texto_limpo(endereco)
   or observacoes is distinct from public.texto_limpo(observacoes);

update public.anamneses set demanda = demanda
where demanda is distinct from public.texto_limpo(demanda)
   or objetivos is distinct from public.texto_limpo(objetivos)
   or historico is distinct from public.texto_limpo(historico);

update public.consultas set observacoes = observacoes
where observacoes is distinct from public.texto_limpo(observacoes);

update public.bloqueios set motivo = motivo
where motivo is distinct from public.texto_limpo(motivo);

update public.evolucoes set demanda = demanda
where demanda ~ '^\s|\s$' or procedimentos ~ '^\s|\s$'
   or resultados ~ '^\s|\s$' or encaminhamentos ~ '^\s|\s$'
   or notas_privadas is distinct from public.texto_limpo(notas_privadas)
   or deleted_motivo is distinct from public.texto_limpo(deleted_motivo);

update public.pagamentos set observacoes = observacoes
where forma_pagamento is distinct from public.texto_limpo(forma_pagamento)
   or observacoes is distinct from public.texto_limpo(observacoes);

update public.preferencias_lembrete set mensagem_template = mensagem_template
where mensagem_template is distinct from public.texto_limpo(mensagem_template);

-- ---------------------------------------------------------------------------
-- Limites (NOT VALID: valem para escrita nova; a 0014 valida o legado)
-- ---------------------------------------------------------------------------

alter table public.psicologas
  add constraint psicologas_nome_valido
    check (char_length(nome) between 1 and 200) not valid,
  add constraint psicologas_email_valido
    check (char_length(email) <= 254 and email = lower(email)) not valid,
  add constraint psicologas_crp_valido
    check (crp is null or char_length(crp) <= 20) not valid;

alter table public.pacientes
  add constraint pacientes_nome_valido
    check (char_length(nome) between 1 and 200) not valid,
  add constraint pacientes_email_valido
    check (
      email is null
      or (char_length(email) <= 254 and email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
    ) not valid,
  add constraint pacientes_telefone_valido
    check (telefone is null or telefone ~ '^\d{10,11}$') not valid,
  add constraint pacientes_cpf_valido
    check (cpf is null or cpf ~ '^\d{11}$') not valid,
  add constraint pacientes_nascimento_valido
    check (data_nascimento is null or data_nascimento between '1900-01-01' and '2100-12-31') not valid,
  add constraint pacientes_endereco_valido
    check (endereco is null or char_length(endereco) <= 300) not valid,
  add constraint pacientes_observacoes_valido
    check (observacoes is null or char_length(observacoes) <= 5000) not valid;

alter table public.anamneses
  add constraint anamneses_tamanho_valido
    check (
      coalesce(char_length(demanda), 0) <= 20000
      and coalesce(char_length(objetivos), 0) <= 20000
      and coalesce(char_length(historico), 0) <= 20000
    ) not valid;

alter table public.consultas
  add constraint consultas_duracao_valida
    check (fim - inicio between interval '15 minutes' and interval '8 hours') not valid,
  add constraint consultas_data_valida
    check (inicio between '2000-01-01' and '2100-12-31') not valid,
  add constraint consultas_observacoes_valido
    check (observacoes is null or char_length(observacoes) <= 2000) not valid,
  -- Link copiado pro paciente: só Meet de verdade (evita link de phishing
  -- gravado direto pela API aparecer na tela como "link da consulta").
  add constraint consultas_meet_link_valido
    check (meet_link is null or meet_link ~ '^https://meet\.google\.com/[a-z0-9-]+$') not valid,
  add constraint consultas_google_event_valido
    check (google_event_id is null or char_length(google_event_id) <= 1024) not valid,
  add constraint consultas_sync_erro_valido
    check (sync_erro is null or char_length(sync_erro) <= 500) not valid;

alter table public.bloqueios
  add constraint bloqueios_duracao_valida
    check (fim - inicio <= interval '1 day') not valid,
  add constraint bloqueios_data_valida
    check (inicio between '2000-01-01' and '2100-12-31') not valid,
  add constraint bloqueios_motivo_valido
    check (motivo is null or char_length(motivo) <= 200) not valid;

alter table public.evolucoes
  add constraint evolucoes_tamanho_valido
    check (
      char_length(demanda) <= 20000
      and char_length(procedimentos) <= 20000
      and char_length(resultados) <= 20000
      and char_length(encaminhamentos) <= 20000
      and coalesce(char_length(notas_privadas), 0) <= 20000
    ) not valid,
  add constraint evolucoes_data_valida
    check (data_sessao between '2000-01-01' and '2100-12-31') not valid,
  add constraint evolucoes_motivo_valido
    check (deleted_motivo is null or char_length(deleted_motivo) between 3 and 500) not valid;

alter table public.pagamentos
  add constraint pagamentos_valor_valido
    check (valor <= 100000) not valid,
  add constraint pagamentos_datas_validas
    check (
      data_referencia between '2000-01-01' and '2100-12-31'
      and vencimento between '2000-01-01' and '2100-12-31'
      and (data_pagamento is null or data_pagamento between '2000-01-01' and '2100-12-31')
    ) not valid,
  add constraint pagamentos_forma_valida
    check (forma_pagamento is null or char_length(forma_pagamento) <= 60) not valid,
  add constraint pagamentos_observacoes_valido
    check (observacoes is null or char_length(observacoes) <= 2000) not valid;
