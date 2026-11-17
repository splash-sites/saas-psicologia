-- Cupons de desconto na assinatura (decisões do usuário em 2026-11-17, ver
-- CLAUDE.md, "Cupons de desconto").
--
-- O Asaas não tem cupom nem "desconto nas N primeiras cobranças" (o `discount`
-- dele é desconto por pagar antes do vencimento). Então o controle fica aqui e
-- o servidor troca o valor de cada cobrança no Asaas (PUT /payments/{id}) antes
-- de a psicóloga ver o link — testado no sandbox em 2026-11-17.
--
-- Regras:
-- - desconto em % ou em R$ a menos por mês, durante N meses ou para sempre;
-- - vale nos três planos: o desconto é por mês, aplicado nos meses do cupom que
--   caem dentro de cada cobrança (trimestral = 3 meses numa cobrança);
-- - um cupom de desconto por conta (além do cupom de dias grátis, que segue à
--   parte em cupom_resgates);
-- - vale para quem ainda não assinou e para quem cancelou e vai assinar de novo;
-- - "para sempre": a assinatura já nasce no Asaas com o valor menor.

-- 1. Cupom ganha tipo -----------------------------------------------------------

alter table public.cupons add column if not exists tipo text not null default 'dias';
alter table public.cupons alter column dias drop not null;
alter table public.cupons add column if not exists desconto_tipo text;
alter table public.cupons add column if not exists desconto_valor numeric(10, 2);
-- null = para sempre
alter table public.cupons add column if not exists desconto_meses int;

alter table public.cupons drop constraint if exists cupons_tipo_check;
alter table public.cupons add constraint cupons_tipo_check
  check (tipo in ('dias', 'desconto'));

alter table public.cupons drop constraint if exists cupons_desconto_meses_check;
alter table public.cupons add constraint cupons_desconto_meses_check
  check (desconto_meses is null or desconto_meses between 1 and 120);

-- Cada tipo com os seus campos e só eles. O limite fino (nenhuma cobrança
-- abaixo de R$ 5, o mínimo do Asaas) depende dos preços dos planos e fica no
-- servidor, ao criar o cupom; aqui só o que nunca pode acontecer.
alter table public.cupons drop constraint if exists cupons_campos_do_tipo_check;
alter table public.cupons add constraint cupons_campos_do_tipo_check check (
  (tipo = 'dias'
    and dias is not null
    and desconto_tipo is null and desconto_valor is null and desconto_meses is null)
  or
  (tipo = 'desconto'
    and dias is null
    -- "is not null" explícito: numa CHECK, comparação com null passa.
    and desconto_tipo is not null and desconto_valor is not null
    and (
      (desconto_tipo = 'percentual' and desconto_valor > 0 and desconto_valor < 100)
      or (desconto_tipo = 'valor' and desconto_valor > 0 and desconto_valor < 1000)
    ))
);

-- 2. Cupom de desconto usado pela conta -----------------------------------------
-- Cópia do desconto (editar o cupom depois não muda o de quem já usou).
-- asaas_subscription_id nulo = reservado, assinatura ainda sendo criada.

create table if not exists public.cupom_descontos (
  id uuid primary key default gen_random_uuid(),
  cupom_id uuid not null references public.cupons(id) on delete restrict,
  codigo text not null,
  psicologa_id uuid not null unique references public.psicologas(id) on delete cascade,
  desconto_tipo text not null check (desconto_tipo in ('percentual', 'valor')),
  desconto_valor numeric(10, 2) not null check (desconto_valor > 0),
  meses_total int check (meses_total is null or meses_total between 1 and 120),
  meses_usados int not null default 0 check (meses_usados >= 0),
  asaas_subscription_id text,
  created_at timestamptz not null default now()
);

create index if not exists cupom_descontos_cupom_idx on public.cupom_descontos (cupom_id);
create index if not exists cupom_descontos_sub_idx on public.cupom_descontos (asaas_subscription_id);

alter table public.cupom_descontos enable row level security;

drop policy if exists "cupom_descontos_select_own" on public.cupom_descontos;
create policy "cupom_descontos_select_own"
  on public.cupom_descontos for select
  using ((select auth.uid()) = psicologa_id);

-- 3. Cobranças que receberam desconto -------------------------------------------
-- Uma linha por cobrança do Asaas: impede aplicar duas vezes (webhook
-- reentregue, ou webhook e tela ao mesmo tempo) e conta os meses usados.

create table if not exists public.cobrancas_desconto (
  asaas_payment_id text primary key,
  desconto_id uuid not null references public.cupom_descontos(id) on delete cascade,
  psicologa_id uuid not null references public.psicologas(id) on delete cascade,
  meses int not null check (meses between 1 and 6),
  valor_original numeric(10, 2),
  valor_cobrado numeric(10, 2),
  created_at timestamptz not null default now()
);

create index if not exists cobrancas_desconto_desconto_idx on public.cobrancas_desconto (desconto_id);

alter table public.cobrancas_desconto enable row level security;
-- Sem policies: só o servidor (service_role) lê e grava.

-- 4. Valor da fatura em aberto --------------------------------------------------
-- Com desconto, a fatura pode ser menor que assinaturas.valor (preço do plano).

alter table public.assinaturas add column if not exists valor_fatura_atual numeric(10, 2);

-- 5. Cupom de desconto digitado onde vale dias grátis ---------------------------
-- aplicar_cupom (cadastro, login com Google, "Tenho um cupom") passa a devolver
-- 'cupom_de_desconto' para não tentar somar dias nulos ao teste. O aviso do
-- cadastro guarda o código, e a tela de Assinatura já o deixa preenchido.

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
  -- Cupom de desconto não depende de a conta já ter assinado: responde antes.
  select * into v_cupom from public.cupons where codigo = v_codigo;
  if found and v_cupom.ativo and v_cupom.tipo = 'desconto' then
    return 'cupom_de_desconto';
  end if;

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

-- 6. Conferir um cupom de desconto (prévia na tela, sem reservar) ---------------
-- Devolve {status, codigo, desconto_tipo, desconto_valor, desconto_meses}.
-- status: ok | invalido | expirado | esgotado | ja_usou | cupom_de_dias |
-- muitas_tentativas | sem_sessao. Código inexistente conta como tentativa
-- errada (o mesmo limite de 10 por hora dos cupons de dias).

create or replace function public.validar_cupom_desconto(p_psicologa_id uuid, p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cupom public.cupons;
  v_usos int;
begin
  if exists (select 1 from public.cupom_descontos where psicologa_id = p_psicologa_id) then
    return jsonb_build_object('status', 'ja_usou');
  end if;

  select * into v_cupom from public.cupons where codigo = upper(trim(coalesce(p_codigo, '')));
  if not found or not v_cupom.ativo then
    return jsonb_build_object('status', 'invalido');
  end if;
  if v_cupom.tipo <> 'desconto' then
    return jsonb_build_object('status', 'cupom_de_dias');
  end if;
  if v_cupom.valido_ate is not null and v_cupom.valido_ate < current_date then
    return jsonb_build_object('status', 'expirado');
  end if;
  if v_cupom.limite_usos is not null then
    select count(*) into v_usos from public.cupom_descontos where cupom_id = v_cupom.id;
    if v_usos >= v_cupom.limite_usos then
      return jsonb_build_object('status', 'esgotado');
    end if;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'cupom_id', v_cupom.id,
    'codigo', v_cupom.codigo,
    'desconto_tipo', v_cupom.desconto_tipo,
    'desconto_valor', v_cupom.desconto_valor,
    'desconto_meses', v_cupom.desconto_meses
  );
end;
$$;

revoke all on function public.validar_cupom_desconto(uuid, text) from public, anon, authenticated;
grant execute on function public.validar_cupom_desconto(uuid, text) to service_role;

create or replace function public.consultar_cupom_desconto(p_codigo text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_resultado jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'sem_sessao');
  end if;
  if (select count(*) from public.cupom_tentativas
      where psicologa_id = v_uid and created_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('status', 'muitas_tentativas');
  end if;

  v_resultado := public.validar_cupom_desconto(v_uid, p_codigo);
  if v_resultado ->> 'status' = 'invalido' then
    insert into public.cupom_tentativas (psicologa_id) values (v_uid);
  end if;
  -- A prévia não precisa do id interno do cupom.
  return v_resultado - 'cupom_id';
end;
$$;

revoke all on function public.consultar_cupom_desconto(text) from public, anon;
grant execute on function public.consultar_cupom_desconto(text) to authenticated;

-- 7. Reservar o cupom ao assinar ------------------------------------------------
-- Chamada pela psicóloga logada, no clique em "Assinar". Trava a assinatura e a
-- linha do cupom (o limite de usos não estoura com dois cliques ao mesmo tempo).
-- Além dos status de validar_cupom_desconto: ja_assinou (assinatura em vigor) e
-- em_andamento (outra assinatura sendo criada agora).

create or replace function public.reservar_cupom_desconto(p_codigo text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_assinatura public.assinaturas;
  v_resultado jsonb;
  v_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'sem_sessao');
  end if;
  if (select count(*) from public.cupom_tentativas
      where psicologa_id = v_uid and created_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('status', 'muitas_tentativas');
  end if;

  select * into v_assinatura from public.assinaturas where psicologa_id = v_uid for update;
  if not found
     or (v_assinatura.asaas_subscription_id is not null and v_assinatura.status <> 'cancelada') then
    return jsonb_build_object('status', 'ja_assinou');
  end if;

  -- Reserva que ficou para trás (o servidor caiu entre reservar e criar a
  -- assinatura no Asaas): libera depois de 10 minutos.
  delete from public.cupom_descontos
  where psicologa_id = v_uid
    and asaas_subscription_id is null
    and created_at < now() - interval '10 minutes';
  if exists (select 1 from public.cupom_descontos
             where psicologa_id = v_uid and asaas_subscription_id is null) then
    return jsonb_build_object('status', 'em_andamento');
  end if;

  perform 1 from public.cupons where codigo = upper(trim(coalesce(p_codigo, ''))) for update;
  v_resultado := public.validar_cupom_desconto(v_uid, p_codigo);
  if v_resultado ->> 'status' = 'invalido' then
    insert into public.cupom_tentativas (psicologa_id) values (v_uid);
  end if;
  if v_resultado ->> 'status' <> 'ok' then
    return v_resultado - 'cupom_id';
  end if;

  insert into public.cupom_descontos (cupom_id, codigo, psicologa_id, desconto_tipo, desconto_valor, meses_total)
  values (
    (v_resultado ->> 'cupom_id')::uuid,
    v_resultado ->> 'codigo',
    v_uid,
    v_resultado ->> 'desconto_tipo',
    (v_resultado ->> 'desconto_valor')::numeric,
    (v_resultado ->> 'desconto_meses')::int
  )
  returning id into v_id;

  return (v_resultado - 'cupom_id') || jsonb_build_object('reserva_id', v_id);
end;
$$;

revoke all on function public.reservar_cupom_desconto(text) from public, anon;
grant execute on function public.reservar_cupom_desconto(text) to authenticated;

-- 8. Meses de desconto de uma cobrança ------------------------------------------
-- Servidor (tela de Assinatura e webhook PAYMENT_CREATED). Quantos meses de
-- desconto cabem nesta cobrança (até a duração do plano), já descontados do
-- saldo. Devolve {status: ok | sem_desconto | permanente | esgotado |
-- ja_aplicado, meses, desconto_tipo, desconto_valor}.

create or replace function public.reservar_meses_desconto(
  p_subscription_id text,
  p_payment_id text,
  p_meses_plano int
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_desconto public.cupom_descontos;
  v_meses int;
begin
  select * into v_desconto
  from public.cupom_descontos
  where asaas_subscription_id = p_subscription_id
  for update;
  if not found then
    return jsonb_build_object('status', 'sem_desconto');
  end if;
  -- Para sempre: a assinatura já foi criada com o valor menor.
  if v_desconto.meses_total is null then
    return jsonb_build_object('status', 'permanente');
  end if;
  if exists (select 1 from public.cobrancas_desconto where asaas_payment_id = p_payment_id) then
    return jsonb_build_object('status', 'ja_aplicado');
  end if;

  v_meses := least(p_meses_plano, v_desconto.meses_total - v_desconto.meses_usados);
  if v_meses <= 0 then
    return jsonb_build_object('status', 'esgotado');
  end if;

  insert into public.cobrancas_desconto (asaas_payment_id, desconto_id, psicologa_id, meses)
  values (p_payment_id, v_desconto.id, v_desconto.psicologa_id, v_meses);
  update public.cupom_descontos set meses_usados = meses_usados + v_meses where id = v_desconto.id;

  return jsonb_build_object(
    'status', 'ok',
    'meses', v_meses,
    'desconto_tipo', v_desconto.desconto_tipo,
    'desconto_valor', v_desconto.desconto_valor
  );
end;
$$;

revoke all on function public.reservar_meses_desconto(text, text, int) from public, anon, authenticated;
grant execute on function public.reservar_meses_desconto(text, text, int) to service_role;

-- Desfaz a reserva quando o Asaas recusou a troca de valor (o webhook devolve
-- erro e o Asaas reenvia).
create or replace function public.devolver_meses_desconto(p_payment_id text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_linha public.cobrancas_desconto;
begin
  delete from public.cobrancas_desconto where asaas_payment_id = p_payment_id returning * into v_linha;
  if found then
    update public.cupom_descontos
    set meses_usados = greatest(0, meses_usados - v_linha.meses)
    where id = v_linha.desconto_id;
  end if;
end;
$$;

revoke all on function public.devolver_meses_desconto(text) from public, anon, authenticated;
grant execute on function public.devolver_meses_desconto(text) to service_role;
