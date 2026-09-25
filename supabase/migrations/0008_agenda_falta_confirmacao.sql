-- Agenda: status "falta" e confirmação manual de presença.
--
-- falta: o paciente não compareceu. Continua ocupando o horário (a trava de
--   sobreposição só ignora "cancelada") e não gera pendência de evolução.
-- confirmada_em: a psicóloga marca à mão quando o paciente confirma (o lembrete
--   continua só informativo — o sistema não lê respostas). Remarcar a consulta
--   limpa a confirmação.
--
-- Sem policy nova: as colunas ficam sob as policies existentes de consultas.

alter type public.consulta_status add value if not exists 'falta';

alter table public.consultas
  add column confirmada_em timestamptz;
