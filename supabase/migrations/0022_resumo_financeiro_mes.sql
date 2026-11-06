-- Os três números financeiros do painel numa consulta só (antes eram três
-- requisições ao PostgREST a cada abertura do painel):
--   recebido   = pagos com data_pagamento no mês;
--   a_receber  = pendentes que vencem no mês;
--   atrasados  = quantidade de pendentes com vencimento antes de hoje (qualquer mês).
-- Mesmas regras de antes (src/app/(app)/dashboard/page.tsx). "Hoje" vem do app
-- (dia de Brasília), como nas outras telas.
--
-- security invoker: roda com o RLS de quem chama; o filtro por auth.uid() é
-- redundante de propósito (defesa em profundidade, e ajuda o planner).

create or replace function public.resumo_financeiro_mes(
  p_inicio date,
  p_fim date,
  p_hoje date
)
returns table (recebido numeric, a_receber numeric, atrasados integer)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(sum(valor) filter (
      where status = 'pago' and data_pagamento between p_inicio and p_fim
    ), 0),
    coalesce(sum(valor) filter (
      where status = 'pendente' and vencimento between p_inicio and p_fim
    ), 0),
    (count(*) filter (where status = 'pendente' and vencimento < p_hoje))::integer
  from public.pagamentos
  where psicologa_id = (select auth.uid())
    and deleted_at is null;
$$;

revoke all on function public.resumo_financeiro_mes(date, date, date) from public, anon;
grant execute on function public.resumo_financeiro_mes(date, date, date) to authenticated;
