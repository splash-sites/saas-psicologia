-- Evolução sem campo obrigatório (feedback da psicóloga, decidido em 2026-11-23).
-- Os 4 campos continuam, mas nenhum é obrigatório: basta UM preenchido, e as
-- notas privadas contam. Vazio vira NULL, como no resto do banco.
--
-- Aplicar no SQL Editor de produção ANTES do push do código: o código novo
-- grava NULL nos campos vazios, e sem esta migration o NOT NULL recusaria.
-- Idempotente (pode rodar de novo).

alter table public.evolucoes
  alter column demanda drop not null,
  alter column procedimentos drop not null,
  alter column resultados drop not null,
  alter column encaminhamentos drop not null;

-- Agora os 4 campos também passam pelo texto_limpo (trim; vazio vira NULL).
create or replace function public.normalizar_evolucao()
returns trigger
language plpgsql
as $$
begin
  new.demanda := public.texto_limpo(new.demanda);
  new.procedimentos := public.texto_limpo(new.procedimentos);
  new.resultados := public.texto_limpo(new.resultados);
  new.encaminhamentos := public.texto_limpo(new.encaminhamentos);
  new.notas_privadas := public.texto_limpo(new.notas_privadas);
  new.deleted_motivo := public.texto_limpo(new.deleted_motivo);
  return new;
end;
$$;

alter table public.evolucoes drop constraint if exists evolucoes_campos_minimos;
alter table public.evolucoes drop constraint if exists evolucoes_algum_campo;
-- Todas as evoluções existentes têm os 4 campos: a regra nova vale já validada.
alter table public.evolucoes
  add constraint evolucoes_algum_campo check (
    coalesce(demanda, procedimentos, resultados, encaminhamentos, notas_privadas) is not null
  );
