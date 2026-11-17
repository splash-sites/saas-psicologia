-- Painel /admin enxerga o cupom de desconto (entrega 3 dos cupons de desconto,
-- 2026-11-17; ver CLAUDE.md, "Cupons de desconto na assinatura").
--
-- 1. admin_uso_contas / admin_usuarios ganham `cupom_desconto` (código do
--    cupom de desconto usado pela conta). Mudar o retorno exige recriar.
-- 2. Receita mensal estimada: quem está nos meses com desconto entra pelo
--    valor da última cobrança com desconto, não pelo preço do plano.
-- 3. Indicadores: quantas assinaturas vieram com cupom de desconto.
-- 4. admin_desconto_do_cupom(): quanto um cupom já deu de desconto em R$.

drop function if exists public.admin_usuarios(uuid);
drop function if exists public.admin_uso_contas(uuid);

create or replace function public.admin_uso_contas(p_id uuid default null)
returns table (
  psicologa_id uuid,
  pacientes bigint,
  consultas bigint,
  evolucoes bigint,
  pagou boolean,
  cupom text,
  cupom_desconto text,
  ultima_atividade timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with
  pac as (
    select x.psicologa_id, count(*) filter (where x.deleted_at is null) as n, max(x.updated_at) as ult
    from public.pacientes x where p_id is null or x.psicologa_id = p_id group by 1
  ),
  con as (
    select x.psicologa_id, count(*) filter (where x.deleted_at is null) as n, max(x.updated_at) as ult
    from public.consultas x where p_id is null or x.psicologa_id = p_id group by 1
  ),
  evo as (
    select x.psicologa_id, count(*) filter (where x.deleted_at is null) as n, max(x.updated_at) as ult
    from public.evolucoes x where p_id is null or x.psicologa_id = p_id group by 1
  ),
  pag as (
    select x.psicologa_id, max(x.updated_at) as ult
    from public.pagamentos x where p_id is null or x.psicologa_id = p_id group by 1
  ),
  pagos as (
    select distinct e.psicologa_id
    from public.assinatura_eventos e
    where e.tipo_evento in ('PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED')
      and (p_id is null or e.psicologa_id = p_id)
  )
  select
    p.id,
    coalesce(pac.n, 0),
    coalesce(con.n, 0),
    coalesce(evo.n, 0),
    pagos.psicologa_id is not null,
    r.codigo,
    -- Só o que virou assinatura (reserva em andamento não conta).
    case when d.asaas_subscription_id is not null then d.codigo end,
    greatest(pac.ult, con.ult, evo.ult, pag.ult)
  from public.psicologas p
  left join pac on pac.psicologa_id = p.id
  left join con on con.psicologa_id = p.id
  left join evo on evo.psicologa_id = p.id
  left join pag on pag.psicologa_id = p.id
  left join pagos on pagos.psicologa_id = p.id
  left join public.cupom_resgates r on r.psicologa_id = p.id
  left join public.cupom_descontos d on d.psicologa_id = p.id
  where p_id is null or p.id = p_id;
$$;

create or replace function public.admin_usuarios(p_id uuid default null)
returns table (
  id uuid,
  nome text,
  email text,
  cadastro timestamptz,
  ultimo_login timestamptz,
  situacao text,
  plano text,
  valor numeric,
  trial_fim date,
  proximo_vencimento date,
  pagou boolean,
  cupom text,
  cupom_desconto text,
  pacientes bigint,
  consultas bigint,
  evolucoes bigint,
  ultima_atividade timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.nome, p.email, p.created_at, u.last_sign_in_at,
    public.situacao_conta(a), a.plano, a.valor, a.trial_fim, a.proximo_vencimento,
    uso.pagou, uso.cupom, uso.cupom_desconto, uso.pacientes, uso.consultas, uso.evolucoes, uso.ultima_atividade
  from public.psicologas p
  join public.assinaturas a on a.psicologa_id = p.id
  join public.admin_uso_contas(p_id) uso on uso.psicologa_id = p.id
  left join auth.users u on u.id = p.id
  where p_id is null or p.id = p_id
  order by p.created_at desc;
$$;

-- Valor da cobrança atual de uma assinatura ativa, por mês. Com cupom por N
-- meses, vale a última cobrança com desconto enquanto o período dela não
-- acabou: ainda há meses de desconto por cobrar, ou a cobrança foi criada há
-- menos de 40 dias (o Asaas cria ~40 dias antes do vencimento) + a duração
-- do plano. Cupom para sempre já está em assinaturas.valor.
create or replace function public.admin_valor_mensal(p_psicologa_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select c.valor_cobrado
      from public.cupom_descontos d
      join lateral (
        select x.valor_cobrado, x.created_at
        from public.cobrancas_desconto x
        where x.desconto_id = d.id
        order by x.created_at desc
        limit 1
      ) c on true
      where d.psicologa_id = a.psicologa_id
        and d.asaas_subscription_id = a.asaas_subscription_id
        and d.meses_total is not null
        and c.valor_cobrado is not null
        and (
          d.meses_usados < d.meses_total
          or c.created_at + interval '40 days'
             + make_interval(months => case a.plano when 'trimestral' then 3 when 'semestral' then 6 else 1 end)
             > now()
        )
    ),
    a.valor
  ) / case a.plano when 'trimestral' then 3 when 'semestral' then 6 else 1 end
  from public.assinaturas a
  where a.psicologa_id = p_psicologa_id;
$$;

create or replace function public.admin_indicadores()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with contas as (
    select
      p.id, p.created_at, a.trial_fim, a.status, a.valor, a.plano,
      public.situacao_conta(a) as situacao,
      public.admin_valor_mensal(p.id) as valor_mensal,
      uso.pagou, uso.cupom is not null as usou_cupom,
      uso.cupom_desconto is not null as usou_desconto,
      uso.ultima_atividade
    from public.psicologas p
    join public.assinaturas a on a.psicologa_id = p.id
    join public.admin_uso_contas(null) uso on uso.psicologa_id = p.id
  ),
  semanas as (
    select generate_series(
      date_trunc('week', (now() at time zone 'America/Sao_Paulo')::date) - interval '7 weeks',
      date_trunc('week', (now() at time zone 'America/Sao_Paulo')::date),
      interval '1 week'
    )::date as inicio
  ),
  por_semana as (
    select
      w.inicio,
      count(c.id) as cadastros,
      count(c.id) filter (where c.usou_cupom) as com_cupom
    from semanas w
    left join contas c
      on (c.created_at at time zone 'America/Sao_Paulo')::date >= w.inicio
     and (c.created_at at time zone 'America/Sao_Paulo')::date < w.inicio + 7
    group by w.inicio
  )
  select jsonb_build_object(
    'total', (select count(*) from contas),
    'por_situacao', (
      select coalesce(jsonb_object_agg(situacao, n), '{}'::jsonb)
      from (select situacao, count(*) as n from contas group by situacao) s
    ),
    'receita_mensal', (select coalesce(sum(valor_mensal), 0) from contas where status = 'ativa'),
    'ativas_30_dias', (select count(*) from contas where ultima_atividade >= now() - interval '30 days'),
    'teste_acabou', (select count(*) from contas where trial_fim < current_date or pagou),
    'converteram', (select count(*) from contas where pagou),
    'com_desconto', (select count(*) from contas where usou_desconto),
    'com_desconto_pagando', (select count(*) from contas where usou_desconto and situacao = 'pagando'),
    'cadastros_semana', (
      select jsonb_agg(jsonb_build_object('inicio', inicio, 'cadastros', cadastros, 'com_cupom', com_cupom) order by inicio)
      from por_semana
    )
  );
$$;

-- Quanto um cupom de desconto já descontou, em R$, nas cobranças ajustadas.
-- Cupom para sempre não passa por cobrancas_desconto (a assinatura já nasce
-- com o valor menor): devolve 0 e a tela explica.
create or replace function public.admin_desconto_do_cupom(p_cupom_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(x.valor_original - x.valor_cobrado), 0)
  from public.cobrancas_desconto x
  join public.cupom_descontos d on d.id = x.desconto_id
  where d.cupom_id = p_cupom_id
    and x.valor_original is not null
    and x.valor_cobrado is not null;
$$;

revoke all on function public.admin_uso_contas(uuid) from public, anon, authenticated;
revoke all on function public.admin_usuarios(uuid) from public, anon, authenticated;
revoke all on function public.admin_valor_mensal(uuid) from public, anon, authenticated;
revoke all on function public.admin_indicadores() from public, anon, authenticated;
revoke all on function public.admin_desconto_do_cupom(uuid) from public, anon, authenticated;
grant execute on function public.admin_uso_contas(uuid) to service_role;
grant execute on function public.admin_usuarios(uuid) to service_role;
grant execute on function public.admin_valor_mensal(uuid) to service_role;
grant execute on function public.admin_indicadores() to service_role;
grant execute on function public.admin_desconto_do_cupom(uuid) to service_role;
