-- Auditoria de escalabilidade e segurança (2026-11-06).

-- 1. Índices para consultas que crescem com o histórico.
--
-- Evoluções por data (painel e agenda buscam por data_sessao; o RLS filtra por
-- psicologa_id). Antes só havia índice em psicologa_id sozinho.
create index if not exists evolucoes_psicologa_data_idx
  on public.evolucoes (psicologa_id, data_sessao)
  where deleted_at is null;

-- Pendentes por vencimento (resumo_financeiro_mes conta os atrasados de
-- qualquer mês).
create index if not exists pagamentos_pendentes_vencimento_idx
  on public.pagamentos (psicologa_id, vencimento)
  where deleted_at is null and status = 'pendente';

-- O rate limit do webhook do Asaas conta os eventos do último minuto.
create index if not exists assinatura_eventos_created_at_idx
  on public.assinatura_eventos (created_at);


-- 2. Limite de exportação: exportar a conta inteira (ZIP) ou o prontuário em
-- PDF lê muitos dados; cliques repetidos sobrecarregam o banco. Funciona entre
-- instâncias serverless porque o registro fica no banco. Também serve de
-- histórico de quem exportou o quê (boa prática LGPD).
create table if not exists public.exportacoes (
  id bigint generated always as identity primary key,
  psicologa_id uuid not null default auth.uid()
    references public.psicologas(id) on delete cascade,
  tipo text not null check (tipo in ('conta', 'prontuario')),
  paciente_id uuid references public.pacientes(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists exportacoes_psicologa_created_idx
  on public.exportacoes (psicologa_id, created_at desc);

alter table public.exportacoes enable row level security;

-- Só lê e registra as próprias. Sem update/delete (histórico). Sem a trava de
-- assinatura: exportar precisa funcionar em somente leitura (guarda de 5 anos).
drop policy if exists "exportacoes_select_own" on public.exportacoes;
create policy "exportacoes_select_own"
  on public.exportacoes for select
  using ((select auth.uid()) = psicologa_id);

drop policy if exists "exportacoes_insert_own" on public.exportacoes;
create policy "exportacoes_insert_own"
  on public.exportacoes for insert
  with check ((select auth.uid()) = psicologa_id);

-- Registra a exportação se estiver dentro do limite; devolve false se não.
-- Limites por minuto: conta inteira 1, prontuário em PDF 10 (exportar vários
-- pacientes seguidos é uso normal). security invoker: RLS de quem chama.
create or replace function public.registrar_exportacao(
  p_tipo text,
  p_paciente_id uuid default null
)
returns boolean
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  limite int := case p_tipo when 'conta' then 1 when 'prontuario' then 10 else 0 end;
  recentes int;
begin
  select count(*) into recentes
  from public.exportacoes
  where psicologa_id = (select auth.uid())
    and tipo = p_tipo
    and created_at > now() - interval '1 minute';
  if recentes >= limite then
    return false;
  end if;
  insert into public.exportacoes (psicologa_id, tipo, paciente_id)
  values ((select auth.uid()), p_tipo, p_paciente_id);
  return true;
end;
$$;


-- 3. Funções do schema public: só usuárias logadas (e o servidor) executam.
-- O Postgres dá EXECUTE a PUBLIC por padrão e o Supabase também ao anon; o app
-- não chama nenhuma função sem login. Funções de extensões (btree_gist) ficam
-- como estão. Triggers não dependem de EXECUTE de quem grava.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
      )
  loop
    execute format('revoke execute on function %s from public, anon', f.assinatura);
    execute format('grant execute on function %s to authenticated, service_role', f.assinatura);
  end loop;
end;
$$;

-- E para as funções criadas daqui em diante (pelo dono das migrations).
alter default privileges in schema public revoke execute on functions from public, anon;
alter default privileges in schema public grant execute on functions to authenticated, service_role;
