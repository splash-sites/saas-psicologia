-- Módulo de agenda (itens 8-11 do MVP): consultas e bloqueios de horário.
-- Sem integração com Google Calendar aqui — isso é o módulo 5.
-- Padrão multi-tenant de sempre: psicologa_id + RLS.

create extension if not exists btree_gist;

create type public.consulta_modalidade as enum ('online', 'presencial');
create type public.consulta_status as enum ('agendada', 'realizada', 'cancelada');
create type public.recorrencia as enum ('nenhuma', 'semanal', 'quinzenal', 'mensal');

create table public.consultas (
  id uuid primary key default gen_random_uuid(),
  psicologa_id uuid not null references public.psicologas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete restrict,
  inicio timestamptz not null,
  fim timestamptz not null,
  modalidade public.consulta_modalidade not null,
  status public.consulta_status not null default 'agendada',
  recorrencia public.recorrencia not null default 'nenhuma',
  -- Agrupa as ocorrências geradas a partir de um agendamento recorrente.
  serie_id uuid,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint consultas_intervalo_valido check (fim > inicio)
);

create index consultas_psicologa_inicio_idx
  on public.consultas (psicologa_id, inicio)
  where deleted_at is null;

create index consultas_paciente_idx
  on public.consultas (paciente_id)
  where deleted_at is null;

create index consultas_serie_idx on public.consultas (serie_id)
  where serie_id is not null;

-- Barra dupla marcação: nenhuma consulta ativa da mesma psicóloga pode
-- se sobrepor no tempo. Consultas canceladas ou arquivadas não contam.
alter table public.consultas
  add constraint consultas_sem_sobreposicao
  exclude using gist (
    psicologa_id with =,
    tstzrange(inicio, fim) with &&
  )
  where (status <> 'cancelada' and deleted_at is null);

alter table public.consultas enable row level security;

create policy "consultas_select_own"
  on public.consultas for select
  using (auth.uid() = psicologa_id);

create policy "consultas_insert_own"
  on public.consultas for insert
  with check (auth.uid() = psicologa_id);

create policy "consultas_update_own"
  on public.consultas for update
  using (auth.uid() = psicologa_id)
  with check (auth.uid() = psicologa_id);

create trigger consultas_set_updated_at
  before update on public.consultas
  for each row execute function public.set_updated_at();

create table public.bloqueios (
  id uuid primary key default gen_random_uuid(),
  psicologa_id uuid not null references public.psicologas(id) on delete cascade,
  inicio timestamptz not null,
  fim timestamptz not null,
  motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bloqueios_intervalo_valido check (fim > inicio)
);

create index bloqueios_psicologa_inicio_idx
  on public.bloqueios (psicologa_id, inicio);

alter table public.bloqueios
  add constraint bloqueios_sem_sobreposicao
  exclude using gist (
    psicologa_id with =,
    tstzrange(inicio, fim) with &&
  );

alter table public.bloqueios enable row level security;

create policy "bloqueios_select_own"
  on public.bloqueios for select
  using (auth.uid() = psicologa_id);

create policy "bloqueios_insert_own"
  on public.bloqueios for insert
  with check (auth.uid() = psicologa_id);

create policy "bloqueios_update_own"
  on public.bloqueios for update
  using (auth.uid() = psicologa_id)
  with check (auth.uid() = psicologa_id);

create policy "bloqueios_delete_own"
  on public.bloqueios for delete
  using (auth.uid() = psicologa_id);

create trigger bloqueios_set_updated_at
  before update on public.bloqueios
  for each row execute function public.set_updated_at();
