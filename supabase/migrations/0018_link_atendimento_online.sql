-- Link fixo de atendimento online da psicóloga (sala do Meet, Zoom etc.).
--
-- Com a integração do Google Agenda desligada (src/lib/google/flag.ts), a
-- consulta online não ganha link do Meet automático: o app usa este link no
-- painel, na agenda e no lembrete do WhatsApp. Com a integração ligada, o link
-- gerado pelo Google (consultas.meet_link) tem prioridade e este vira reserva.
--
-- RLS: coberto pelas policies de psicologas (cada uma só lê/edita a própria
-- linha). Só https, para o link não virar porta de javascript: ou similar.

alter table public.psicologas
  add column link_atendimento_online text;

alter table public.psicologas
  add constraint psicologas_link_online_valido check (
    link_atendimento_online is null
    or (
      char_length(link_atendimento_online) <= 500
      and link_atendimento_online ~ '^https://[^[:space:]]+$'
    )
  );
