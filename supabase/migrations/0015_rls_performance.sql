-- Performance do RLS com muitos tenants.
--
-- As policies usavam `auth.uid() = psicologa_id`. Escrito assim, o Postgres
-- reavalia auth.uid() linha a linha e não usa o índice de psicologa_id: com a
-- tabela de consultas de todas as contas, cada listagem varria a tabela
-- inteira (medido: 220 mil linhas para devolver as 20 mil de uma conta).
--
-- Com `(select auth.uid())` o valor vira um InitPlan calculado uma vez por
-- consulta, e o planner usa os índices (psicologa_id, ...). Recomendação do
-- próprio Supabase ("auth_rls_initplan" no Performance Advisor).
--
-- Também: assinatura_permite_escrita(psicologa_id) passa a receber
-- (select auth.uid()) — equivalente, porque toda policy de escrita já exige
-- psicologa_id = auth.uid() — e então roda uma vez por comando, não por linha.
--
-- Reescreve TODAS as policies do schema public de uma vez (inclusive as que
-- vierem com o mesmo padrão), sem mudar nenhuma regra de acesso. Idempotente:
-- policy já reescrita é pulada.

do $$
declare
  p record;
  novo_using text;
  novo_check text;
  sql text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
  loop
    novo_using := p.qual;
    novo_check := p.with_check;

    if novo_using is not null and novo_using not like '%SELECT auth.uid()%' then
      novo_using := replace(novo_using, 'assinatura_permite_escrita(psicologa_id)', 'assinatura_permite_escrita(auth.uid())');
      novo_using := replace(novo_using, 'auth.uid()', '(select auth.uid())');
    end if;
    if novo_check is not null and novo_check not like '%SELECT auth.uid()%' then
      novo_check := replace(novo_check, 'assinatura_permite_escrita(psicologa_id)', 'assinatura_permite_escrita(auth.uid())');
      novo_check := replace(novo_check, 'auth.uid()', '(select auth.uid())');
    end if;

    if novo_using is distinct from p.qual or novo_check is distinct from p.with_check then
      sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
      if novo_using is not null then sql := sql || format(' using (%s)', novo_using); end if;
      if novo_check is not null then sql := sql || format(' with check (%s)', novo_check); end if;
      execute sql;
    end if;
  end loop;
end $$;

-- As funções auxiliares da 0012 comparam com auth.uid() dentro de subconsulta
-- por registro referenciado; mesmo ajuste para o valor ser calculado uma vez.
create or replace function public.paciente_da_psicologa(p_paciente_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.pacientes
    where id = p_paciente_id and psicologa_id = (select auth.uid())
  );
$$;

create or replace function public.consulta_da_psicologa(p_consulta_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_consulta_id is null or exists (
    select 1 from public.consultas
    where id = p_consulta_id and psicologa_id = (select auth.uid())
  );
$$;

-- Índices que faltavam para filtros por conta usados nas telas.
create index if not exists pagamentos_consulta_idx on public.pagamentos (consulta_id) where consulta_id is not null;
create index if not exists evolucoes_consulta_idx on public.evolucoes (consulta_id) where consulta_id is not null;
