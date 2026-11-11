-- Cupons de dias grátis (decisões do usuário em 2026-11-11, ver CLAUDE.md,
-- "Feature nova: cupons e indicadores").
--
-- O cupom estende o teste grátis (assinaturas.trial_fim). Só vale para quem
-- ainda não assinou, um por conta. Teste correndo: soma ao fim atual; teste
-- vencido: conta a partir de hoje (greatest(trial_fim, hoje) + dias).
--
-- Ninguém lê a tabela de cupons pelo app (RLS sem policy): o código só é
-- conferido dentro de aplicar_cupom(), que trava a linha do cupom (FOR UPDATE)
-- para o limite de usos não estourar com dois resgates ao mesmo tempo.

-- 1. Cupons ------------------------------------------------------------------

create table if not exists public.cupons (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique
    check (codigo ~ '^[A-Z0-9][A-Z0-9_-]{2,29}$'),
  dias int not null check (dias between 1 and 365),
  valido_ate date,
  limite_usos int check (limite_usos is null or limite_usos > 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.cupons enable row level security;
-- Sem policies: nem a psicóloga logada nem o visitante leem cupons.

-- 2. Resgates: um por conta ---------------------------------------------------

create table if not exists public.cupom_resgates (
  id uuid primary key default gen_random_uuid(),
  cupom_id uuid not null references public.cupons(id) on delete restrict,
  -- Cópia do código: a psicóloga vê "Cupom PSICO30 aplicado" sem ler cupons.
  codigo text not null,
  psicologa_id uuid not null unique references public.psicologas(id) on delete cascade,
  trial_fim_antes date not null,
  trial_fim_depois date not null,
  created_at timestamptz not null default now()
);

create index if not exists cupom_resgates_cupom_idx on public.cupom_resgates (cupom_id);

alter table public.cupom_resgates enable row level security;

-- A psicóloga vê o próprio resgate (a tela de Assinatura mostra o cupom usado).
drop policy if exists "cupom_resgates_select_own" on public.cupom_resgates;
create policy "cupom_resgates_select_own"
  on public.cupom_resgates for select
  using ((select auth.uid()) = psicologa_id);

-- 3. Tentativas erradas (contra adivinhar códigos) ----------------------------

create table if not exists public.cupom_tentativas (
  id bigint generated always as identity primary key,
  psicologa_id uuid not null references public.psicologas(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists cupom_tentativas_conta_idx
  on public.cupom_tentativas (psicologa_id, created_at desc);

alter table public.cupom_tentativas enable row level security;
-- Sem policies: só as funções abaixo leem e gravam.

-- 4. Resultado do cupom digitado no cadastro ----------------------------------
-- A conta nasce antes de a pessoa entrar (confirmação de e-mail), então o
-- resultado fica guardado e o Painel mostra uma vez.

create table if not exists public.cupom_avisos (
  psicologa_id uuid primary key references public.psicologas(id) on delete cascade,
  codigo text not null,
  status text not null,
  created_at timestamptz not null default now(),
  lido_em timestamptz
);

alter table public.cupom_avisos enable row level security;

drop policy if exists "cupom_avisos_select_own" on public.cupom_avisos;
create policy "cupom_avisos_select_own"
  on public.cupom_avisos for select
  using ((select auth.uid()) = psicologa_id);

drop policy if exists "cupom_avisos_update_own" on public.cupom_avisos;
create policy "cupom_avisos_update_own"
  on public.cupom_avisos for update
  using ((select auth.uid()) = psicologa_id)
  with check ((select auth.uid()) = psicologa_id);

-- Só dá para marcar como lido, não reescrever o aviso.
revoke insert, update, delete on public.cupom_avisos from anon, authenticated;
grant update (lido_em) on public.cupom_avisos to authenticated;

-- 5. Aplicar um cupom numa conta ----------------------------------------------
-- Uso interno (trigger do cadastro, login com Google pelo servidor e
-- resgatar_cupom). Não é exposta a usuárias: recebe o id da conta.
-- Devolve: ok | invalido | expirado | esgotado | ja_usou | ja_assinou.

create or replace function public.aplicar_cupom(p_psicologa_id uuid, p_codigo text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_codigo text := upper(trim(coalesce(p_codigo, '')));
  v_cupom public.cupons;
  v_assinatura public.assinaturas;
  v_novo_fim date;
  v_usos int;
begin
  select * into v_assinatura
  from public.assinaturas
  where psicologa_id = p_psicologa_id
  for update;

  if not found
     or v_assinatura.asaas_subscription_id is not null
     or v_assinatura.status <> 'trial' then
    return 'ja_assinou';
  end if;

  if exists (select 1 from public.cupom_resgates where psicologa_id = p_psicologa_id) then
    return 'ja_usou';
  end if;

  select * into v_cupom from public.cupons where codigo = v_codigo for update;
  if not found or not v_cupom.ativo then
    return 'invalido';
  end if;

  if v_cupom.valido_ate is not null and v_cupom.valido_ate < current_date then
    return 'expirado';
  end if;

  if v_cupom.limite_usos is not null then
    select count(*) into v_usos from public.cupom_resgates where cupom_id = v_cupom.id;
    if v_usos >= v_cupom.limite_usos then
      return 'esgotado';
    end if;
  end if;

  v_novo_fim := greatest(v_assinatura.trial_fim, current_date) + v_cupom.dias;

  update public.assinaturas
  set trial_fim = v_novo_fim
  where psicologa_id = p_psicologa_id;

  insert into public.cupom_resgates (cupom_id, codigo, psicologa_id, trial_fim_antes, trial_fim_depois)
  values (v_cupom.id, v_cupom.codigo, p_psicologa_id, v_assinatura.trial_fim, v_novo_fim);

  return 'ok';
end;
$$;

revoke all on function public.aplicar_cupom(uuid, text) from public, anon, authenticated;
grant execute on function public.aplicar_cupom(uuid, text) to service_role;

-- 6. Resgate pela psicóloga logada (tela de Assinatura) -----------------------
-- Limite: 10 códigos inexistentes por hora por conta. Mesmos retornos de
-- aplicar_cupom, mais: muitas_tentativas | sem_sessao.

create or replace function public.resgatar_cupom(p_codigo text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_erradas int;
  v_status text;
begin
  if v_uid is null then
    return 'sem_sessao';
  end if;

  select count(*) into v_erradas
  from public.cupom_tentativas
  where psicologa_id = v_uid and created_at > now() - interval '1 hour';
  if v_erradas >= 10 then
    return 'muitas_tentativas';
  end if;

  v_status := public.aplicar_cupom(v_uid, p_codigo);
  if v_status = 'invalido' then
    insert into public.cupom_tentativas (psicologa_id) values (v_uid);
  end if;
  return v_status;
end;
$$;

revoke all on function public.resgatar_cupom(text) from public, anon;
grant execute on function public.resgatar_cupom(text) to authenticated;

-- 7. Cupom digitado no cadastro (e-mail e senha) ------------------------------
-- O formulário manda o código nos metadados do signUp (raw_user_meta_data
-- ->> 'cupom'). Qualquer falha aqui não pode impedir a conta de nascer.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_cupom text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'cupom', '')), '');
begin
  insert into public.psicologas (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email
  );
  insert into public.assinaturas (psicologa_id) values (new.id);

  if v_cupom is not null then
    begin
      insert into public.cupom_avisos (psicologa_id, codigo, status)
      values (new.id, upper(left(v_cupom, 30)), public.aplicar_cupom(new.id, v_cupom));
    exception when others then
      null;
    end;
  end if;

  return new;
end;
$$;
