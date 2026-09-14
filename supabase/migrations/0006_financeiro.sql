-- Módulo 7: financeiro (itens 19-22 do MVP).
-- Lançamento manual de pagamento por paciente/sessão — sem gateway nessa
-- ponta, é só registro. Padrão multi-tenant de sempre: psicologa_id + RLS.
--
-- "Atrasado" não é um estado gravado: é derivado (pendente + vencimento no
-- passado). Evita o lançamento ficar com status errado por falta de alguém
-- virar manualmente. status na coluna só tem pendente/pago.

create type public.pagamento_status as enum ('pendente', 'pago');

create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  psicologa_id uuid not null references public.psicologas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete restrict,
  consulta_id uuid references public.consultas(id) on delete set null,
  valor numeric(10, 2) not null check (valor > 0),
  status public.pagamento_status not null default 'pendente',
  -- Competência do lançamento (mês a que a sessão/cobrança se refere).
  data_referencia date not null,
  vencimento date not null,
  data_pagamento date,
  forma_pagamento text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pagamentos_pago_tem_data_pagamento check (
    status <> 'pago' or data_pagamento is not null
  )
);

create index pagamentos_psicologa_referencia_idx
  on public.pagamentos (psicologa_id, data_referencia)
  where deleted_at is null;

create index pagamentos_paciente_idx
  on public.pagamentos (paciente_id)
  where deleted_at is null;

alter table public.pagamentos enable row level security;

create policy "pagamentos_select_own"
  on public.pagamentos for select
  using (auth.uid() = psicologa_id);

create policy "pagamentos_insert_own"
  on public.pagamentos for insert
  with check (auth.uid() = psicologa_id);

create policy "pagamentos_update_own"
  on public.pagamentos for update
  using (auth.uid() = psicologa_id)
  with check (auth.uid() = psicologa_id);

-- Sem policy de DELETE: um lançamento errado se arquiva (soft delete), não some.

create trigger pagamentos_set_updated_at
  before update on public.pagamentos
  for each row execute function public.set_updated_at();
