-- Sessões já encerradas sem evolução, de qualquer data (o painel só lista as
-- dos últimos 14 dias; o card e a tela /evolucoes/pendentes mostram todas).
--
-- Mesma regra do painel (src/app/(app)/dashboard/page.tsx e exigeEvolucao):
--   * consulta não arquivada, status agendada/realizada (cancelada e falta não
--     exigem evolução), já terminada;
--   * paciente não arquivado (alta/inativo entram: o registro continua devido);
--   * conta como registrada se há evolução ativa ligada à consulta OU do mesmo
--     paciente na mesma data (evolução criada pela página do paciente não fica
--     ligada à consulta).
--
-- security invoker: roda com o RLS de quem chama; o filtro por auth.uid() é
-- redundante de propósito (defesa em profundidade, e ajuda o planner).

create or replace function public.consultas_sem_evolucao()
returns table (
  id uuid,
  inicio timestamptz,
  fim timestamptz,
  paciente_id uuid,
  paciente_nome text
)
language sql
stable
security invoker
set search_path = public
as $$
  select c.id, c.inicio, c.fim, p.id, p.nome
  from public.consultas c
  join public.pacientes p
    on p.id = c.paciente_id and p.deleted_at is null
  where c.psicologa_id = (select auth.uid())
    and c.deleted_at is null
    and c.status in ('agendada', 'realizada')
    and c.fim <= now()
    and not exists (
      select 1
      from public.evolucoes e
      where e.deleted_at is null
        and (
          e.consulta_id = c.id
          or (
            e.paciente_id = c.paciente_id
            and e.data_sessao = (c.inicio at time zone 'America/Sao_Paulo')::date
          )
        )
    )
  order by c.inicio desc;
$$;

revoke all on function public.consultas_sem_evolucao() from public, anon;
grant execute on function public.consultas_sem_evolucao() to authenticated;
