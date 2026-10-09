-- Valida as linhas antigas contra as constraints da 0013 (que entraram
-- NOT VALID). Separada de propósito: se o banco de produção tiver algum dado
-- antigo fora do padrão, o VALIDATE falha e nada muda — corrija e rode de novo.
--
-- No cloud, ANTES de aplicar, rode esta consulta no SQL Editor. Ela lista o
-- que impediria a validação (zero linhas = pode aplicar):
--
--   select 'pacientes' tabela, id, 'nome/email/telefone/cpf/nascimento/endereco/obs' problema
--   from public.pacientes
--   where not (char_length(nome) between 1 and 200)
--      or (email is not null and not (char_length(email) <= 254 and email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'))
--      or (telefone is not null and telefone !~ '^\d{10,11}$')
--      or (cpf is not null and cpf !~ '^\d{11}$')
--      or (data_nascimento is not null and data_nascimento not between '1900-01-01' and '2100-12-31')
--      or char_length(endereco) > 300 or char_length(observacoes) > 5000
--   union all
--   select 'consultas', id, 'duracao/data/observacoes/meet_link'
--   from public.consultas
--   where fim - inicio not between interval '15 minutes' and interval '8 hours'
--      or inicio not between '2000-01-01' and '2100-12-31'
--      or char_length(observacoes) > 2000
--      or (meet_link is not null and meet_link !~ '^https://meet\.google\.com/[a-z0-9-]+$')
--   union all
--   select 'bloqueios', id, 'duracao/data/motivo'
--   from public.bloqueios
--   where fim - inicio > interval '1 day' or inicio not between '2000-01-01' and '2100-12-31'
--      or char_length(motivo) > 200
--   union all
--   select 'evolucoes', id, 'tamanho/data/motivo'
--   from public.evolucoes
--   where greatest(char_length(demanda), char_length(procedimentos), char_length(resultados),
--                  char_length(encaminhamentos), coalesce(char_length(notas_privadas), 0)) > 20000
--      or data_sessao not between '2000-01-01' and '2100-12-31'
--      or (deleted_motivo is not null and char_length(deleted_motivo) not between 3 and 500)
--   union all
--   select 'pagamentos', id, 'valor/datas/forma/obs'
--   from public.pagamentos
--   where valor > 100000
--      or data_referencia not between '2000-01-01' and '2100-12-31'
--      or vencimento not between '2000-01-01' and '2100-12-31'
--      or data_pagamento not between '2000-01-01' and '2100-12-31'
--      or char_length(forma_pagamento) > 60 or char_length(observacoes) > 2000;

alter table public.psicologas validate constraint psicologas_nome_valido;
alter table public.psicologas validate constraint psicologas_email_valido;
alter table public.psicologas validate constraint psicologas_crp_valido;

alter table public.pacientes validate constraint pacientes_nome_valido;
alter table public.pacientes validate constraint pacientes_email_valido;
alter table public.pacientes validate constraint pacientes_telefone_valido;
alter table public.pacientes validate constraint pacientes_cpf_valido;
alter table public.pacientes validate constraint pacientes_nascimento_valido;
alter table public.pacientes validate constraint pacientes_endereco_valido;
alter table public.pacientes validate constraint pacientes_observacoes_valido;

alter table public.anamneses validate constraint anamneses_tamanho_valido;

alter table public.consultas validate constraint consultas_duracao_valida;
alter table public.consultas validate constraint consultas_data_valida;
alter table public.consultas validate constraint consultas_observacoes_valido;
alter table public.consultas validate constraint consultas_meet_link_valido;
alter table public.consultas validate constraint consultas_google_event_valido;
alter table public.consultas validate constraint consultas_sync_erro_valido;

alter table public.bloqueios validate constraint bloqueios_duracao_valida;
alter table public.bloqueios validate constraint bloqueios_data_valida;
alter table public.bloqueios validate constraint bloqueios_motivo_valido;

alter table public.evolucoes validate constraint evolucoes_tamanho_valido;
alter table public.evolucoes validate constraint evolucoes_data_valida;
alter table public.evolucoes validate constraint evolucoes_motivo_valido;

alter table public.pagamentos validate constraint pagamentos_valor_valido;
alter table public.pagamentos validate constraint pagamentos_datas_validas;
alter table public.pagamentos validate constraint pagamentos_forma_valida;
alter table public.pagamentos validate constraint pagamentos_observacoes_valido;
