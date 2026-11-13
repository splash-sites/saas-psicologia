-- Relatório LGPD de 2026-11-12, itens 005 e 010 (decisões do usuário em
-- 2026-11-13).

-- 1. Registro de acesso ao prontuário (item 005) --------------------------------
-- Cada vez que a psicóloga abre a ficha de um paciente (com a anamnese), a
-- lista de evoluções ou uma evolução, fica uma linha: quando, o quê, de qual
-- paciente. Só data, tipo e paciente (sem IP nem navegador — decisão do
-- usuário). Nada do conteúdo. Sem tela por enquanto: fica para auditoria ou
-- incidente. Exportações (PDF e ZIP) já ficam em public.exportacoes (0026).
--
-- Só insere e lê as próprias; sem update/delete (histórico). Sem a trava de
-- assinatura: em somente leitura ela continua abrindo o prontuário.

create table if not exists public.acessos_prontuario (
  id bigint generated always as identity primary key,
  psicologa_id uuid not null default auth.uid()
    references public.psicologas(id) on delete restrict,
  paciente_id uuid not null references public.pacientes(id) on delete restrict,
  evolucao_id uuid references public.evolucoes(id) on delete restrict,
  tipo text not null check (tipo in ('ficha', 'evolucoes', 'evolucao')),
  created_at timestamptz not null default now(),
  constraint acessos_prontuario_evolucao_tipo check ((tipo = 'evolucao') = (evolucao_id is not null))
);

create index if not exists acessos_prontuario_paciente_idx
  on public.acessos_prontuario (psicologa_id, paciente_id, created_at desc);

alter table public.acessos_prontuario enable row level security;

drop policy if exists "acessos_prontuario_select_own" on public.acessos_prontuario;
create policy "acessos_prontuario_select_own"
  on public.acessos_prontuario for select
  using ((select auth.uid()) = psicologa_id);

-- Paciente e evolução precisam ser da própria conta (a FK não passa pelo RLS).
drop policy if exists "acessos_prontuario_insert_own" on public.acessos_prontuario;
create policy "acessos_prontuario_insert_own"
  on public.acessos_prontuario for insert
  with check (
    (select auth.uid()) = psicologa_id
    and public.paciente_da_psicologa(paciente_id)
    and (
      evolucao_id is null
      or exists (
        select 1 from public.evolucoes e
        where e.id = evolucao_id
          and e.paciente_id = acessos_prontuario.paciente_id
          and e.psicologa_id = (select auth.uid())
      )
    )
  );

-- 2. Data do aceite de lembretes (item 010) -------------------------------------
-- Paciente novo começa sem lembrete (antes vinha marcado). A data é gravada
-- pelo banco quando o aceite é marcado e apagada quando é desmarcado; o que
-- vier do cliente nessa coluna é ignorado. Pacientes que já aceitavam seguem
-- aceitando, sem data ("antes do registro").

alter table public.pacientes alter column aceita_lembretes set default false;
alter table public.pacientes add column if not exists lembretes_aceitos_em timestamptz;

create or replace function public.pacientes_data_aceite_lembretes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.lembretes_aceitos_em := case when new.aceita_lembretes then now() end;
  elsif new.aceita_lembretes is distinct from old.aceita_lembretes then
    new.lembretes_aceitos_em := case when new.aceita_lembretes then now() end;
  else
    new.lembretes_aceitos_em := old.lembretes_aceitos_em;
  end if;
  return new;
end;
$$;

drop trigger if exists pacientes_data_aceite_lembretes on public.pacientes;
create trigger pacientes_data_aceite_lembretes
  before insert or update on public.pacientes
  for each row execute function public.pacientes_data_aceite_lembretes();
