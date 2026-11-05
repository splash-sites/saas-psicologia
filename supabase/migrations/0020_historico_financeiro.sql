-- Histórico financeiro somado no banco: uma linha por mês (data_referencia),
-- em vez de a página trazer todos os lançamentos e somar. O PostgREST corta
-- qualquer resposta em max_rows (1000): com ~85 sessões/mês, 12 meses passam
-- disso e os totais saíam errados sem aviso.
--
-- Mesma regra da página (src/app/(app)/financeiro/historico/page.tsx):
-- lançamento não arquivado; "pago" soma em recebido, o resto em a receber.
--
-- security invoker: roda com o RLS de quem chama; o filtro por auth.uid() é
-- redundante de propósito (defesa em profundidade, e ajuda o planner).

create or replace function public.historico_financeiro(p_desde date)
returns table (
  mes text,
  recebido numeric,
  a_receber numeric,
  quantidade bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    to_char(p.data_referencia, 'YYYY-MM') as mes,
    coalesce(sum(p.valor) filter (where p.status = 'pago'), 0) as recebido,
    coalesce(sum(p.valor) filter (where p.status <> 'pago'), 0) as a_receber,
    count(*) as quantidade
  from public.pagamentos p
  where p.psicologa_id = (select auth.uid())
    and p.deleted_at is null
    and p.data_referencia >= p_desde
  group by 1
  order by 1;
$$;

revoke all on function public.historico_financeiro(date) from public, anon;
grant execute on function public.historico_financeiro(date) to authenticated;
