-- Evento com link do Meet (decidido com o usuário em 2026-11-28).
--   * online: a psicóloga ligou "Gerar link do Meet" no evento (desligado por
--     padrão). Com o Google Agenda conectado, o Meet é criado junto com o
--     evento no Google; sem ele, a tela usa o link fixo de atendimento online
--     (psicologas.link_atendimento_online), como nas consultas.
--   * meet_link: o link que o Google devolveu (mesma regra de consultas).
--   * Ninguém é convidado: o evento continua sem convidados no Google.
--   * Evento de dia inteiro não tem Meet.
-- Aplicar no SQL Editor de produção ANTES do push (a agenda lê as colunas).
-- Idempotente.

alter table public.bloqueios
  add column if not exists online boolean not null default false,
  add column if not exists meet_link text;

alter table public.bloqueios
  drop constraint if exists bloqueios_meet_link_valido,
  drop constraint if exists bloqueios_online_valido;
alter table public.bloqueios
  add constraint bloqueios_meet_link_valido
    check (meet_link is null or meet_link ~ '^https://meet\.google\.com/[a-z0-9-]+$'),
  add constraint bloqueios_online_valido
    check (not (online and dia_inteiro));
