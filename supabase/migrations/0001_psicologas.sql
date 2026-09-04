-- Estrutura multi-tenant básica.
-- Cada psicóloga é um tenant. Toda tabela de dado sensível criada a partir
-- daqui deve ter uma coluna psicologa_id (uuid, references psicologas.id)
-- e uma policy de RLS restringindo o acesso a auth.uid() = psicologa dona do registro.

create table if not exists public.psicologas (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  crp text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.psicologas enable row level security;

-- Uma psicóloga só pode ler/editar a própria linha de perfil.
create policy "psicologas_select_own"
  on public.psicologas for select
  using (auth.uid() = id);

create policy "psicologas_update_own"
  on public.psicologas for update
  using (auth.uid() = id);

-- Cria automaticamente o perfil de psicóloga ao criar o usuário no Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.psicologas (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger psicologas_set_updated_at
  before update on public.psicologas
  for each row execute function public.set_updated_at();
