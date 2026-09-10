-- Módulo 5: integração com Google Calendar + link do Meet (itens 12, 17, 18).
-- Sincronização de mão única: sistema -> Google Agenda pessoal da psicóloga.

-- Refresh token OAuth do Google, por psicóloga. Guardado CRIPTOGRAFADO pela
-- aplicação (AES-256-GCM) — a coluna nunca recebe o token em texto plano.
create table public.google_oauth_tokens (
  psicologa_id uuid primary key references public.psicologas(id) on delete cascade,
  refresh_token_cifrado text not null,
  escopo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_oauth_tokens enable row level security;

-- A psicóloga pode ver se está conectada e desconectar (delete), mas nunca
-- ler o token de outra conta. A escrita do token acontece via service_role
-- no callback de auth, fora das policies.
create policy "google_tokens_select_own"
  on public.google_oauth_tokens for select
  using (auth.uid() = psicologa_id);

create policy "google_tokens_delete_own"
  on public.google_oauth_tokens for delete
  using (auth.uid() = psicologa_id);

create trigger google_oauth_tokens_set_updated_at
  before update on public.google_oauth_tokens
  for each row execute function public.set_updated_at();

-- Estado de sincronização de cada consulta com o Google Calendar.
create type public.sync_status as enum ('pendente', 'sincronizada', 'erro', 'desativada');

alter table public.consultas
  add column google_event_id text,
  add column meet_link text,
  add column sync_status public.sync_status not null default 'pendente',
  add column sync_erro text,
  add column sync_em timestamptz;
