-- Financeiro: "A receber" só do que já aconteceu; o futuro vai para o "Previsto"
-- (decisão do usuário em 2026-11-24).
--   * A receber = pendentes de sessão que já terminou + pendentes manuais sem
--     consulta com data até hoje.
--   * Previsto = sessões marcadas que ainda não aconteceram, cada uma uma vez só:
--     com lançamento pendente conta o lançamento; sem lançamento, o valor da
--     consulta; paga adiantado já está em "Recebido" e não entra. Mais os
--     pendentes manuais sem consulta com data futura.
-- Antes, um "ainda vou receber" lançado numa sessão futura entrava no A receber
-- e a mesma sessão ainda contava no Previsto.
-- Aplicar no SQL Editor de produção ANTES do push. Idempotente.

create or replace function public.resumo_sessoes_mes(p_inicio date, p_fim date, p_agora timestamptz)
returns table (a_receber numeric, previsto numeric, sessoes_previstas integer)
language sql
stable
security invoker
set search_path = public
as $$
  with pendentes as (
    select p.valor,
           p.consulta_id is not null as de_sessao,
           case when c.id is not null then c.fim > p_agora
                else p.data_referencia > public.dia_br(p_agora) end as futuro
    from public.pagamentos p
    left join public.consultas c on c.id = p.consulta_id
    where p.psicologa_id = (select auth.uid()) and p.deleted_at is null and p.status = 'pendente'
      and p.data_referencia between p_inicio and p_fim
  ),
  sessoes as (
    select c.valor
    from public.consultas c
    where c.psicologa_id = (select auth.uid()) and c.deleted_at is null and c.status = 'agendada'
      and c.valor is not null and c.fim > p_agora
      and public.dia_br(c.inicio) between p_inicio and p_fim
      and not exists (
        select 1 from public.pagamentos p where p.consulta_id = c.id and p.deleted_at is null
      )
  )
  select
    (select coalesce(sum(valor), 0) from pendentes where not futuro),
    (select coalesce(sum(valor), 0) from pendentes where futuro)
      + (select coalesce(sum(valor), 0) from sessoes),
    ((select count(*) from pendentes where futuro and de_sessao)
      + (select count(*) from sessoes))::integer;
$$;

revoke all on function public.resumo_sessoes_mes(date, date, timestamptz) from public, anon;
grant execute on function public.resumo_sessoes_mes(date, date, timestamptz) to authenticated;
