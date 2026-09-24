-- Módulo 8: lembretes de consulta (item 13 do MVP), sem custo operacional.
--
-- Decisão de produto: em vez da WhatsApp Business API (paga por mensagem),
--   A) lista "Lembretes" com botão wa.me pré-preenchido — 1 clique, enviado do
--      número da própria psicóloga;
--   B) convite do Google Agenda ao paciente (e-mail), automático.
-- Nenhum conteúdo clínico vai em nenhuma das mensagens.

-- Consentimento do paciente para receber lembretes (WhatsApp e convite).
alter table public.pacientes
  add column aceita_lembretes boolean not null default true;

-- Preferências por psicóloga. Sem linha = usa os padrões da aplicação.
create table public.preferencias_lembrete (
  psicologa_id uuid primary key references public.psicologas(id) on delete cascade,
  antecedencia_horas integer not null default 24
    check (antecedencia_horas between 1 and 168),
  -- Nulo = usa o texto padrão da aplicação.
  mensagem_template text check (mensagem_template is null or length(mensagem_template) <= 1000),
  convite_google boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.preferencias_lembrete enable row level security;

create policy "preferencias_lembrete_select_own"
  on public.preferencias_lembrete for select
  using (auth.uid() = psicologa_id);

create policy "preferencias_lembrete_insert_own"
  on public.preferencias_lembrete for insert
  with check (auth.uid() = psicologa_id);

create policy "preferencias_lembrete_update_own"
  on public.preferencias_lembrete for update
  using (auth.uid() = psicologa_id)
  with check (auth.uid() = psicologa_id);

create trigger preferencias_lembrete_set_updated_at
  before update on public.preferencias_lembrete
  for each row execute function public.set_updated_at();

-- Registro de lembretes enviados (manualmente via wa.me). O horário da consulta
-- fica gravado: se ela for remarcada, o lembrete antigo deixa de valer.
create table public.lembretes (
  id uuid primary key default gen_random_uuid(),
  psicologa_id uuid not null references public.psicologas(id) on delete cascade,
  consulta_id uuid not null references public.consultas(id) on delete cascade,
  canal text not null default 'whatsapp_manual' check (canal in ('whatsapp_manual')),
  consulta_inicio timestamptz not null,
  enviado_em timestamptz not null default now(),
  unique (consulta_id, canal)
);

create index lembretes_psicologa_idx on public.lembretes (psicologa_id);

alter table public.lembretes enable row level security;

create policy "lembretes_select_own"
  on public.lembretes for select
  using (auth.uid() = psicologa_id);

create policy "lembretes_insert_own"
  on public.lembretes for insert
  with check (auth.uid() = psicologa_id);

create policy "lembretes_update_own"
  on public.lembretes for update
  using (auth.uid() = psicologa_id)
  with check (auth.uid() = psicologa_id);

-- Sem policy de DELETE: o histórico de envio não some.
