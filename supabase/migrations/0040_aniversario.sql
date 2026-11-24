-- Aniversário do paciente (pedido do usuário em 2026-11-24; item H).
-- O aviso é calculado no código a partir de pacientes.data_nascimento (que já
-- existe). Aqui só a mensagem de parabéns da psicóloga, editável em
-- Configurações (vazio = texto padrão, src/lib/aniversario.ts). Mesmo limite
-- da mensagem do lembrete (LIMITES.aniversario.mensagem = 1000).
-- Grava a própria psicóloga (policy psicologas_update_own).
-- Aplicar no SQL Editor de produção ANTES do push. Idempotente.

alter table public.psicologas
  add column if not exists mensagem_aniversario text;

alter table public.psicologas drop constraint if exists psicologas_mensagem_aniversario_tamanho;
alter table public.psicologas
  add constraint psicologas_mensagem_aniversario_tamanho
  check (mensagem_aniversario is null or char_length(mensagem_aniversario) <= 1000);
