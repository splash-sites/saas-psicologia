-- Lista de pacientes redesenhada (2026-11-24): por paciente, numa chamada só
-- (sem uma consulta por paciente e sem o corte de 1000 linhas do PostgREST):
--   * próxima sessão: a próxima consulta agendada (início e modalidade);
--   * última sessão: a mais recente já terminada, agendada ou realizada
--     (falta e cancelada não contam);
--   * evolução pendente: sessão encerrada nos últimos 14 dias sem evolução —
--     mesma regra de consultas_sem_evolucao() (0019) e do cartão do Painel
--     (DIAS_PENDENCIA = 14);
--   * pagamento em aberto: algum lançamento pendente (no prazo ou atrasado).
-- security invoker: o RLS de quem chama; o filtro por auth.uid() é redundante
-- de propósito (defesa em profundidade). Só pacientes não arquivados.
-- Aplicar no SQL Editor de produção ANTES do push. Idempotente.

create or replace function public.resumo_pacientes(p_agora timestamptz default now())
returns table (
  paciente_id uuid,
  proxima_inicio timestamptz,
  proxima_modalidade text,
  ultima_inicio timestamptz,
  evolucao_pendente boolean,
  pagamento_aberto boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id,
    prox.inicio,
    prox.modalidade::text,
    (
      select max(c.inicio) from public.consultas c
      where c.paciente_id = p.id and c.deleted_at is null
        and c.status in ('agendada', 'realizada') and c.fim <= p_agora
    ),
    exists (
      select 1 from public.consultas c
      where c.paciente_id = p.id and c.deleted_at is null
        and c.status in ('agendada', 'realizada') and c.fim <= p_agora
        and (c.inicio at time zone 'America/Sao_Paulo')::date
            >= (p_agora at time zone 'America/Sao_Paulo')::date - 14
        and not exists (
          select 1 from public.evolucoes e
          where e.deleted_at is null
            and (
              e.consulta_id = c.id
              or (e.paciente_id = c.paciente_id
                  and e.data_sessao = (c.inicio at time zone 'America/Sao_Paulo')::date)
            )
        )
    ),
    exists (
      select 1 from public.pagamentos pg
      where pg.paciente_id = p.id and pg.deleted_at is null and pg.status = 'pendente'
    )
  from public.pacientes p
  left join lateral (
    select c.inicio, c.modalidade from public.consultas c
    where c.paciente_id = p.id and c.deleted_at is null
      and c.status = 'agendada' and c.inicio > p_agora
    order by c.inicio
    limit 1
  ) prox on true
  where p.psicologa_id = (select auth.uid()) and p.deleted_at is null;
$$;

revoke all on function public.resumo_pacientes(timestamptz) from public, anon;
grant execute on function public.resumo_pacientes(timestamptz) to authenticated;

-- A próxima/última sessão por paciente procura por paciente + início.
create index if not exists consultas_paciente_inicio_idx
  on public.consultas (paciente_id, inicio) where deleted_at is null;
