-- Módulo 6: evolução / registro documental por sessão (itens 14-16 do MVP).
--
-- Compliance (Resolução CFP nº 01/2009):
--   Estrutura mínima obrigatória — a evolução NÃO pode ser texto livre solto.
--   Campos: avaliação da demanda/objetivos, procedimentos aplicados,
--   resultados obtidos, encaminhamentos/decisões.
--   Guarda mínima de 5 anos: NUNCA apagar fisicamente. Só soft delete.
--   `notas_privadas` = espaço para "notas técnicas privadas" separadas da
--   evolução (distinção prontuário psicológico x registro documental).
-- Proteção do conteúdo: criptografia em repouso do Postgres (provedor) + RLS.
--   Sem cifra na aplicação por decisão de projeto (risco de perda da chave
--   conflita com a guarda obrigatória).

create table public.evolucoes (
  id uuid primary key default gen_random_uuid(),
  psicologa_id uuid not null references public.psicologas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete restrict,
  consulta_id uuid references public.consultas(id) on delete set null,
  data_sessao date not null,
  demanda text not null,
  procedimentos text not null,
  resultados text not null,
  encaminhamentos text not null,
  notas_privadas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_motivo text,
  constraint evolucoes_campos_minimos check (
    length(btrim(demanda)) > 0
    and length(btrim(procedimentos)) > 0
    and length(btrim(resultados)) > 0
    and length(btrim(encaminhamentos)) > 0
  )
);

create index evolucoes_paciente_data_idx
  on public.evolucoes (paciente_id, data_sessao desc)
  where deleted_at is null;

create index evolucoes_psicologa_idx on public.evolucoes (psicologa_id);

alter table public.evolucoes enable row level security;

create policy "evolucoes_select_own"
  on public.evolucoes for select
  using (auth.uid() = psicologa_id);

create policy "evolucoes_insert_own"
  on public.evolucoes for insert
  with check (auth.uid() = psicologa_id);

create policy "evolucoes_update_own"
  on public.evolucoes for update
  using (auth.uid() = psicologa_id)
  with check (auth.uid() = psicologa_id);

-- Sem policy de DELETE: exclusão física é proibida (guarda de 5 anos).
-- "Arquivar" = update setando deleted_at.

create trigger evolucoes_set_updated_at
  before update on public.evolucoes
  for each row execute function public.set_updated_at();
