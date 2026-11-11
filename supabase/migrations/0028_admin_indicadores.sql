-- Painel /admin, entrega 3 (decisões do usuário em 2026-11-11, ver CLAUDE.md,
-- "Feature nova: cupons e indicadores"): indicadores, lista de usuários e
-- "estender teste".
--
-- Tudo aqui é só para o servidor (service role): nenhuma usuária executa
-- estas funções nem lê extensoes_teste. Nada clínico sai daqui — só dados de
-- conta, de assinatura e contagens.

-- 1. Extensões de teste feitas pelo administrador -----------------------------

create table if not exists public.extensoes_teste (
  id uuid primary key default gen_random_uuid(),
  psicologa_id uuid not null references public.psicologas(id) on delete cascade,
  dias int not null check (dias between 1 and 365),
  motivo text not null check (char_length(motivo) between 3 and 300),
  trial_fim_antes date not null,
  trial_fim_depois date not null,
  criado_por text not null,
  created_at timestamptz not null default now()
);

create index if not exists extensoes_teste_conta_idx
  on public.extensoes_teste (psicologa_id, created_at desc);

alter table public.extensoes_teste enable row level security;
-- Sem policies: só o servidor (service role) lê e grava.

-- 2. Situação de uma conta (mesma regra da tela de Assinatura e da trava) ------
-- teste | teste_encerrado | aguardando | pagando | atrasada | cancelada | somente_leitura

create or replace function public.situacao_conta(a public.assinaturas)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when a.status = 'ativa' then 'pagando'
    when a.status = 'atrasada' then 'atrasada'
    when a.status = 'cancelada' then
      case when greatest(a.proximo_vencimento, a.trial_fim) >= current_date
        then 'cancelada' else 'somente_leitura' end
    when a.asaas_subscription_id is not null then 'aguardando'
    when a.trial_fim >= current_date then 'teste'
    else 'teste_encerrado'
  end;
$$;

-- 3. Estender o teste de uma conta (só quem ainda não assinou) ----------------
-- Devolve: ok | ja_assinou. Teste correndo soma ao fim; vencido conta de hoje.

create or replace function public.admin_estender_teste(
  p_psicologa_id uuid,
  p_dias int,
  p_motivo text,
  p_admin text
)
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_assinatura public.assinaturas;
  v_novo_fim date;
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

  v_novo_fim := greatest(v_assinatura.trial_fim, current_date) + p_dias;

  update public.assinaturas set trial_fim = v_novo_fim where psicologa_id = p_psicologa_id;

  insert into public.extensoes_teste (psicologa_id, dias, motivo, trial_fim_antes, trial_fim_depois, criado_por)
  values (p_psicologa_id, p_dias, trim(p_motivo), v_assinatura.trial_fim, v_novo_fim, p_admin);

  return 'ok';
end;
$$;

-- 4. Uso de cada conta, somado de uma vez por tabela ---------------------------
-- Uma passada em cada tabela (group by), não 9 subconsultas por conta: com
-- milhares de contas a diferença é de segundos. p_id filtra uma conta só.
-- "Última atividade" = última criação/alteração de paciente, consulta,
-- evolução ou lançamento (não lê conteúdo nenhum).

drop function if exists public.admin_usuarios();

create or replace function public.admin_uso_contas(p_id uuid default null)
returns table (
  psicologa_id uuid,
  pacientes bigint,
  consultas bigint,
  evolucoes bigint,
  pagou boolean,
  cupom text,
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
    greatest(pac.ult, con.ult, evo.ult, pag.ult)
  from public.psicologas p
  left join pac on pac.psicologa_id = p.id
  left join con on con.psicologa_id = p.id
  left join evo on evo.psicologa_id = p.id
  left join pag on pag.psicologa_id = p.id
  left join pagos on pagos.psicologa_id = p.id
  left join public.cupom_resgates r on r.psicologa_id = p.id
  where p_id is null or p.id = p_id;
$$;

-- 5. Lista de usuários (security definer: lê auth.users, último login) --------

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
    uso.pagou, uso.cupom, uso.pacientes, uso.consultas, uso.evolucoes, uso.ultima_atividade
  from public.psicologas p
  join public.assinaturas a on a.psicologa_id = p.id
  join public.admin_uso_contas(p_id) uso on uso.psicologa_id = p.id
  left join auth.users u on u.id = p.id
  where p_id is null or p.id = p_id
  order by p.created_at desc;
$$;

-- 6. Indicadores (calculados no banco: o PostgREST corta listas em 1000) -------

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
      uso.pagou, uso.cupom is not null as usou_cupom, uso.ultima_atividade
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
    'receita_mensal', (
      select coalesce(sum(valor / case plano when 'trimestral' then 3 when 'semestral' then 6 else 1 end), 0)
      from contas where status = 'ativa'
    ),
    'ativas_30_dias', (select count(*) from contas where ultima_atividade >= now() - interval '30 days'),
    'teste_acabou', (select count(*) from contas where trial_fim < current_date or pagou),
    'converteram', (select count(*) from contas where pagou),
    'cadastros_semana', (
      select jsonb_agg(jsonb_build_object('inicio', inicio, 'cadastros', cadastros, 'com_cupom', com_cupom) order by inicio)
      from por_semana
    )
  );
$$;

-- 7. Só o servidor executa ----------------------------------------------------

revoke all on function public.situacao_conta(public.assinaturas) from public, anon, authenticated;
revoke all on function public.admin_estender_teste(uuid, int, text, text) from public, anon, authenticated;
revoke all on function public.admin_uso_contas(uuid) from public, anon, authenticated;
revoke all on function public.admin_usuarios(uuid) from public, anon, authenticated;
revoke all on function public.admin_indicadores() from public, anon, authenticated;
grant execute on function public.situacao_conta(public.assinaturas) to service_role;
grant execute on function public.admin_estender_teste(uuid, int, text, text) to service_role;
grant execute on function public.admin_uso_contas(uuid) to service_role;
grant execute on function public.admin_usuarios(uuid) to service_role;
grant execute on function public.admin_indicadores() to service_role;
