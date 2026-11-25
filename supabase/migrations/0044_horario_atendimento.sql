-- Horário de atendimento da psicóloga (decisão do usuário em 2026-11-25).
--
-- Uma linha por dia da semana (0 = domingo … 6 = sábado): atende ou não,
-- e de que hora a que hora. Usado pela prévia de horários livres do
-- formulário de consulta. Não impede marcar fora do horário: só orienta.
-- Almoço e pausas ficam nos eventos (bloqueios) que já existem.
--
-- Sem linhas = padrão do app (segunda a sexta, 08:00 às 20:00; sábado e
-- domingo desligados): vale para contas novas e para as que já existiam,
-- sem precisar semear nada. Salvar em Configurações grava os 7 dias.
--
-- Configuração, não dado clínico: sem a trava de assinatura (igual a
-- preferencias_lembrete). Sem policy de delete.

create table if not exists public.horarios_atendimento (
  psicologa_id uuid not null default auth.uid()
    references public.psicologas(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  ativo boolean not null default false,
  inicio time not null default '08:00',
  fim time not null default '20:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (psicologa_id, dia_semana),
  constraint horarios_atendimento_fim_depois check (fim > inicio)
);

alter table public.horarios_atendimento enable row level security;

drop policy if exists "horarios_atendimento_select_own" on public.horarios_atendimento;
create policy "horarios_atendimento_select_own"
  on public.horarios_atendimento for select
  using ((select auth.uid()) = psicologa_id);

drop policy if exists "horarios_atendimento_insert_own" on public.horarios_atendimento;
create policy "horarios_atendimento_insert_own"
  on public.horarios_atendimento for insert
  with check ((select auth.uid()) = psicologa_id);

drop policy if exists "horarios_atendimento_update_own" on public.horarios_atendimento;
create policy "horarios_atendimento_update_own"
  on public.horarios_atendimento for update
  using ((select auth.uid()) = psicologa_id)
  with check ((select auth.uid()) = psicologa_id);

drop trigger if exists horarios_atendimento_set_updated_at on public.horarios_atendimento;
create trigger horarios_atendimento_set_updated_at
  before update on public.horarios_atendimento
  for each row execute function public.set_updated_at();
