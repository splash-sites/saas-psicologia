-- Módulo de pacientes (itens 4-7 do MVP).
-- Segue o padrão multi-tenant: coluna psicologa_id + RLS restringindo tudo a
-- auth.uid() = psicologa dona do registro.

create type public.paciente_status as enum ('ativo', 'inativo', 'alta');

create table public.pacientes (
  id uuid primary key default gen_random_uuid(),
  psicologa_id uuid not null references public.psicologas(id) on delete cascade,
  nome text not null,
  email text,
  telefone text,
  data_nascimento date,
  cpf text,
  endereco text,
  status public.paciente_status not null default 'ativo',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Soft delete: a anamnese é dado clínico sensível; nunca apagar fisicamente.
  deleted_at timestamptz
);

create index pacientes_psicologa_id_idx on public.pacientes (psicologa_id) where deleted_at is null;

alter table public.pacientes enable row level security;

create policy "pacientes_select_own"
  on public.pacientes for select
  using (auth.uid() = psicologa_id);

create policy "pacientes_insert_own"
  on public.pacientes for insert
  with check (auth.uid() = psicologa_id);

create policy "pacientes_update_own"
  on public.pacientes for update
  using (auth.uid() = psicologa_id)
  with check (auth.uid() = psicologa_id);

-- Sem policy de DELETE: exclusão é sempre soft (set deleted_at via update).

create trigger pacientes_set_updated_at
  before update on public.pacientes
  for each row execute function public.set_updated_at();

-- Ficha de anamnese / avaliação inicial. 1:1 com paciente (uma ficha por paciente).
-- Campos estruturados mínimos do item 5: demanda e objetivos do trabalho.
-- Espaço para "notas técnicas privadas" separadas fica no módulo de evolução.
create table public.anamneses (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null unique references public.pacientes(id) on delete cascade,
  psicologa_id uuid not null references public.psicologas(id) on delete cascade,
  demanda text,
  objetivos text,
  historico text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index anamneses_psicologa_id_idx on public.anamneses (psicologa_id);

alter table public.anamneses enable row level security;

create policy "anamneses_select_own"
  on public.anamneses for select
  using (auth.uid() = psicologa_id);

create policy "anamneses_insert_own"
  on public.anamneses for insert
  with check (auth.uid() = psicologa_id);

create policy "anamneses_update_own"
  on public.anamneses for update
  using (auth.uid() = psicologa_id)
  with check (auth.uid() = psicologa_id);

create trigger anamneses_set_updated_at
  before update on public.anamneses
  for each row execute function public.set_updated_at();
