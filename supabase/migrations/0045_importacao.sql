-- Importar dados de outro sistema (PsicoManager), decisões do usuário em
-- 2026-11-25. A planilha é lida no navegador; o servidor grava em lotes com o
-- client da própria psicóloga (RLS e trava de assinatura valem como sempre).
--
--   * importacoes: histórico (quando, de onde, quantos), da própria conta.
--   * origem_id em pacientes e consultas: chave do registro no sistema de
--     origem (PsicoManager não exporta id: nome normalizado; sessão =
--     paciente + data + hora). Único por conta: importar de novo não duplica.
--   * importacao_id em pacientes, consultas, evoluções e pagamentos: de qual
--     importação veio (rastro; não é chave estrangeira de outra conta porque a
--     policy de importacoes só deixa ler a própria).
--   * consultas.dispensa_evolucao: sessão passada importada não vira
--     "evolução pendente" (decisão do usuário: o sistema antigo tinha sessões
--     sem anotação de 2020). Sessão futura importada segue a regra normal.

create table if not exists public.importacoes (
  id uuid primary key default gen_random_uuid(),
  psicologa_id uuid not null default auth.uid()
    references public.psicologas(id) on delete restrict,
  origem text not null check (origem in ('psicomanager')),
  criada_em timestamptz not null default now(),
  concluida_em timestamptz,
  -- Contagens do que entrou/foi pulado (sem dado clínico).
  resumo jsonb
);

create index if not exists importacoes_psicologa_idx on public.importacoes (psicologa_id, criada_em desc);

alter table public.importacoes enable row level security;

drop policy if exists "importacoes_select_own" on public.importacoes;
create policy "importacoes_select_own"
  on public.importacoes for select
  using ((select auth.uid()) = psicologa_id);

-- Importar é escrever: respeita a trava de assinatura (somente leitura não importa).
drop policy if exists "importacoes_insert_own" on public.importacoes;
create policy "importacoes_insert_own"
  on public.importacoes for insert
  with check ((select auth.uid()) = psicologa_id and public.assinatura_permite_escrita(psicologa_id));

drop policy if exists "importacoes_update_own" on public.importacoes;
create policy "importacoes_update_own"
  on public.importacoes for update
  using ((select auth.uid()) = psicologa_id)
  with check ((select auth.uid()) = psicologa_id);

alter table public.pacientes
  add column if not exists importacao_id uuid references public.importacoes(id) on delete restrict,
  add column if not exists origem_id text;
alter table public.consultas
  add column if not exists importacao_id uuid references public.importacoes(id) on delete restrict,
  add column if not exists origem_id text,
  add column if not exists dispensa_evolucao boolean not null default false;
alter table public.evolucoes
  add column if not exists importacao_id uuid references public.importacoes(id) on delete restrict;
alter table public.pagamentos
  add column if not exists importacao_id uuid references public.importacoes(id) on delete restrict;

alter table public.pacientes drop constraint if exists pacientes_origem_unica;
alter table public.pacientes
  add constraint pacientes_origem_unica unique (psicologa_id, origem_id);
alter table public.consultas drop constraint if exists consultas_origem_unica;
alter table public.consultas
  add constraint consultas_origem_unica unique (psicologa_id, origem_id);

alter table public.pacientes drop constraint if exists pacientes_origem_id_valido;
alter table public.pacientes
  add constraint pacientes_origem_id_valido check (origem_id is null or char_length(origem_id) <= 300);
alter table public.consultas drop constraint if exists consultas_origem_id_valido;
alter table public.consultas
  add constraint consultas_origem_id_valido check (origem_id is null or char_length(origem_id) <= 300);

-- Evoluções pendentes: sem as sessões dispensadas (mesma regra da 0019) ------
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
    and not c.dispensa_evolucao
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

-- Lista de pacientes (0042): mesma dispensa na "evolução pendente" ---------------
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
        and not c.dispensa_evolucao
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
