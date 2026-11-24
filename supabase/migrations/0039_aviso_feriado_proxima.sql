-- Aviso de feriado na sessão anterior (feedback da psicóloga, decidido em
-- 2026-11-23; entrega F). Se a próxima consulta marcada do paciente cai em
-- feriado ou ponto facultativo, a sessão imediatamente anterior mostra o aviso
-- (calculado no código, src/lib/agenda/feriadoProxima.ts). "Já combinei" grava
-- aqui, na consulta do feriado, a data que foi combinada: se ela for remarcada
-- para outro dia, a data não bate mais e o aviso volta a valer para o dia novo.
-- Aplicar no SQL Editor de produção ANTES do push. Idempotente.

alter table public.consultas
  add column if not exists aviso_feriado_dispensado_para date;
