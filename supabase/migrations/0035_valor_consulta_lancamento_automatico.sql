-- Valor na consulta e lançamento automático (feedback da psicóloga, decidido
-- em 2026-11-23; entrega C).
--
--   * consultas.valor: vem do valor da sessão do paciente ao marcar; editável
--     por sessão. NULL = sem cobrança (e as consultas de antes desta migration).
--   * consultas.cobrar: na falta, a psicóloga escolhe cobrar ou não.
--   * Depois que a sessão acontece (fim <= agora), nasce sozinho um lançamento
--     "a receber" (pagamentos.origem = 'sessao'), um por consulta, que
--     acompanha a consulta enquanto estiver pendente: remarcar muda as datas,
--     mudar o valor muda o lançamento, cancelar/arquivar/falta sem cobrança o
--     arquiva (arquivado_pela_consulta) e voltar atrás o restaura. Pago nunca é
--     mexido pelo sistema (a tela oferece "Cancelar pagamento (devolvido)").
--   * Vencimento: por sessão = dia da sessão; mensal = dia X do mês seguinte
--     (X do paciente no momento em que o lançamento nasce).
--   * Quem cria: gerar_lancamentos_sessoes() ao abrir Painel/Financeiro/Agenda
--     e uma vez por dia pelo cron da Vercel (service role, todas as contas); e
--     o trigger da consulta, na hora, quando uma mudança já a deixa cobrável.
--
-- Aplicar no SQL Editor de produção ANTES do push. Idempotente.

alter table public.consultas
  add column if not exists valor numeric(10, 2),
  add column if not exists cobrar boolean not null default true;

alter table public.consultas drop constraint if exists consultas_valor_valido;
alter table public.consultas
  add constraint consultas_valor_valido check (valor is null or (valor > 0 and valor <= 100000));

alter table public.pagamentos
  add column if not exists origem text not null default 'manual',
  add column if not exists arquivado_pela_consulta boolean not null default false;

alter table public.pagamentos drop constraint if exists pagamentos_origem_valida;
alter table public.pagamentos
  add constraint pagamentos_origem_valida check (origem in ('manual', 'sessao'));

-- Um lançamento automático por consulta (o "on conflict" do gerador usa este
-- índice: duas abas abertas ao mesmo tempo não duplicam).
create unique index if not exists pagamentos_sessao_unico
  on public.pagamentos (consulta_id) where origem = 'sessao';
create index if not exists pagamentos_consulta_idx
  on public.pagamentos (consulta_id) where consulta_id is not null;
-- Só as consultas com valor entram no gerador (as antigas ficam de fora).
create index if not exists consultas_cobraveis_idx
  on public.consultas (psicologa_id, fim) where valor is not null and deleted_at is null;

-- Dia da sessão no fuso de Brasília.
create or replace function public.dia_br(p timestamptz)
returns date
language sql
immutable
set search_path = public
as $$
  select (p at time zone 'America/Sao_Paulo')::date;
$$;

-- Por sessão: o próprio dia. Mensal: dia X do mês seguinte (no último dia,
-- se o mês for mais curto: dia 31 em fevereiro vira 28/29).
create or replace function public.vencimento_da_sessao(p_cobranca text, p_dia int, p_data date)
returns date
language sql
immutable
set search_path = public
as $$
  select case
    when p_cobranca = 'mensal' then
      (date_trunc('month', p_data) + interval '1 month')::date
        + (least(
            p_dia,
            extract(day from (date_trunc('month', p_data) + interval '2 months' - interval '1 day'))::int
          ) - 1)
    else p_data
  end;
$$;

create or replace function public.consulta_cobravel(p_status public.consulta_status, p_cobrar boolean, p_valor numeric, p_deleted_at timestamptz)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_deleted_at is null
    and p_valor is not null
    and (p_status in ('agendada', 'realizada') or (p_status = 'falta' and p_cobrar));
$$;

-- Cria/restaura os lançamentos das sessões que já aconteceram. Para a
-- psicóloga logada (RLS), ou para todas as contas com a service role (cron).
-- Conta em somente leitura: não cria nada (o RLS recusaria de qualquer jeito).
create or replace function public.gerar_lancamentos_sessoes()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_restaurados integer;
  v_criados integer;
begin
  if v_uid is not null and not public.assinatura_permite_escrita(v_uid) then
    return 0;
  end if;

  -- Arquivado pela própria consulta (ex.: remarcada para o futuro) e que
  -- voltou a ser cobrável.
  update public.pagamentos g
     set deleted_at = null, arquivado_pela_consulta = false
    from public.consultas c
   where g.consulta_id = c.id
     and g.origem = 'sessao'
     and g.arquivado_pela_consulta
     and g.status = 'pendente'
     and c.fim <= now()
     and public.consulta_cobravel(c.status, c.cobrar, c.valor, c.deleted_at)
     and (v_uid is null or c.psicologa_id = v_uid);
  get diagnostics v_restaurados = row_count;

  insert into public.pagamentos
    (psicologa_id, paciente_id, consulta_id, valor, status, data_referencia, vencimento, origem)
  select c.psicologa_id, c.paciente_id, c.id, c.valor, 'pendente',
         public.dia_br(c.inicio),
         public.vencimento_da_sessao(p.cobranca, p.cobranca_dia, public.dia_br(c.inicio)),
         'sessao'
    from public.consultas c
    join public.pacientes p on p.id = c.paciente_id
   where c.valor is not null
     and c.deleted_at is null
     and c.fim <= now()
     and public.consulta_cobravel(c.status, c.cobrar, c.valor, c.deleted_at)
     and (v_uid is null or c.psicologa_id = v_uid)
     -- Já tem lançamento desta consulta (automático, ou lançado à mão antes)?
     and not exists (select 1 from public.pagamentos g where g.consulta_id = c.id)
  on conflict (consulta_id) where origem = 'sessao' do nothing;
  get diagnostics v_criados = row_count;

  return v_restaurados + v_criados;
end;
$$;

revoke all on function public.gerar_lancamentos_sessoes() from public, anon;
grant execute on function public.gerar_lancamentos_sessoes() to authenticated, service_role;

-- O lançamento automático acompanha a consulta.
create or replace function public.lancamento_acompanha_consulta()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  l public.pagamentos%rowtype;
  v_cobravel boolean := public.consulta_cobravel(new.status, new.cobrar, new.valor, new.deleted_at);
  v_agora boolean := new.fim <= now();
  v_dia date := public.dia_br(new.inicio);
  v_cobranca text;
  v_cobranca_dia int;
begin
  select * into l from public.pagamentos where consulta_id = new.id and origem = 'sessao';

  if not found then
    -- Ficou cobrável com a sessão já passada (ex.: falta com cobrança, valor
    -- posto numa sessão antiga): cria na hora, se não houver lançamento manual.
    if v_cobravel and v_agora
       and not exists (select 1 from public.pagamentos g where g.consulta_id = new.id) then
      select cobranca, cobranca_dia into v_cobranca, v_cobranca_dia
        from public.pacientes where id = new.paciente_id;
      insert into public.pagamentos
        (psicologa_id, paciente_id, consulta_id, valor, status, data_referencia, vencimento, origem)
      values
        (new.psicologa_id, new.paciente_id, new.id, new.valor, 'pendente', v_dia,
         public.vencimento_da_sessao(coalesce(v_cobranca, 'sessao'), coalesce(v_cobranca_dia, 10), v_dia),
         'sessao')
      on conflict (consulta_id) where origem = 'sessao' do nothing;
    end if;
    return null;
  end if;

  -- Pago: o sistema não mexe (devolução é decisão da psicóloga).
  if l.status <> 'pendente' then
    return null;
  end if;

  if v_cobravel and v_agora then
    select cobranca, cobranca_dia into v_cobranca, v_cobranca_dia
      from public.pacientes where id = new.paciente_id;
    update public.pagamentos
       set valor = new.valor,
           data_referencia = v_dia,
           -- Só recalcula o vencimento se a sessão mudou de dia.
           vencimento = case when l.data_referencia = v_dia then l.vencimento
                             else public.vencimento_da_sessao(coalesce(v_cobranca, 'sessao'), coalesce(v_cobranca_dia, 10), v_dia) end,
           deleted_at = case when l.arquivado_pela_consulta then null else l.deleted_at end,
           arquivado_pela_consulta = false
     where id = l.id;
  elsif l.deleted_at is null then
    -- Cancelada, arquivada, falta sem cobrança, sem valor ou remarcada para o
    -- futuro: sai do "a receber" (volta se a consulta voltar a ser cobrável).
    update public.pagamentos
       set deleted_at = now(), arquivado_pela_consulta = true
     where id = l.id;
  end if;
  return null;
end;
$$;

drop trigger if exists consultas_lancamento on public.consultas;
create trigger consultas_lancamento
  after insert or update of inicio, fim, valor, status, cobrar, deleted_at on public.consultas
  for each row execute function public.lancamento_acompanha_consulta();

-- Financeiro: em aberto por paciente (todos os meses) e os números do mês.
create or replace function public.em_aberto_por_paciente(p_hoje date)
returns table (paciente_id uuid, nome text, quantidade integer, total numeric, mais_antigo date, atrasados integer)
language sql
stable
security invoker
set search_path = public
as $$
  select g.paciente_id, p.nome, count(*)::integer, sum(g.valor), min(g.data_referencia),
         (count(*) filter (where g.vencimento < p_hoje))::integer
    from public.pagamentos g
    join public.pacientes p on p.id = g.paciente_id
   where g.psicologa_id = (select auth.uid())
     and g.deleted_at is null
     and g.status = 'pendente'
   group by g.paciente_id, p.nome
   order by sum(g.valor) desc;
$$;

revoke all on function public.em_aberto_por_paciente(date) from public, anon;
grant execute on function public.em_aberto_por_paciente(date) to authenticated;

-- A receber das sessões do mês já realizadas (lançamentos pendentes com
-- referência no mês) e o previsto das sessões ainda marcadas até o fim do mês.
create or replace function public.resumo_sessoes_mes(p_inicio date, p_fim date, p_agora timestamptz)
returns table (a_receber numeric, previsto numeric, sessoes_previstas integer)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select coalesce(sum(valor), 0) from public.pagamentos
      where psicologa_id = (select auth.uid()) and deleted_at is null and status = 'pendente'
        and data_referencia between p_inicio and p_fim),
    (select coalesce(sum(valor), 0) from public.consultas
      where psicologa_id = (select auth.uid()) and deleted_at is null and status = 'agendada'
        and valor is not null and fim > p_agora
        and public.dia_br(inicio) between p_inicio and p_fim),
    (select count(*)::integer from public.consultas
      where psicologa_id = (select auth.uid()) and deleted_at is null and status = 'agendada'
        and valor is not null and fim > p_agora
        and public.dia_br(inicio) between p_inicio and p_fim);
$$;

revoke all on function public.resumo_sessoes_mes(date, date, timestamptz) from public, anon;
grant execute on function public.resumo_sessoes_mes(date, date, timestamptz) to authenticated;
