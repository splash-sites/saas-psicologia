-- Bloqueio melhorado (feedback da psicóloga, decidido em 2026-11-23; entrega D):
--   * dia inteiro, inclusive vários dias seguidos (férias) num bloqueio só:
--     inicio = 00:00 do primeiro dia, fim = 00:00 do dia seguinte ao último
--     (Brasília), dia_inteiro = true;
--   * recorrente (semanal/quinzenal/mensal até uma data): uma linha por
--     ocorrência, ligadas por serie_id, como as consultas;
--   * motivo obrigatório nos bloqueios novos (os antigos sem motivo ficam);
--   * vai para o Google Agenda da psicóloga ("Bloqueado: <motivo>"), por isso
--     google_event_id/sync_* como nas consultas.
-- Bloqueio não é dado clínico: continua com exclusão física.
-- Aplicar no SQL Editor de produção ANTES do push. Idempotente.

alter table public.bloqueios
  add column if not exists dia_inteiro boolean not null default false,
  add column if not exists recorrencia public.recorrencia not null default 'nenhuma',
  add column if not exists serie_id uuid,
  add column if not exists google_event_id text,
  add column if not exists sync_status public.sync_status not null default 'pendente',
  add column if not exists sync_erro text,
  add column if not exists sync_em timestamptz;

create index if not exists bloqueios_serie_idx on public.bloqueios (serie_id) where serie_id is not null;
-- A agenda busca por sobreposição (início antes do fim da semana e fim depois do início).
create index if not exists bloqueios_psicologa_fim_idx on public.bloqueios (psicologa_id, fim);

alter table public.bloqueios drop constraint if exists bloqueios_duracao_valida;
alter table public.bloqueios
  -- Vários dias: no máximo 1 ano num bloqueio só.
  add constraint bloqueios_duracao_valida check (fim - inicio <= interval '366 days'),
  drop constraint if exists bloqueios_sync_erro_valido;
alter table public.bloqueios
  add constraint bloqueios_sync_erro_valido check (sync_erro is null or char_length(sync_erro) <= 500);

-- Motivo obrigatório só ao criar (CHECK valeria também para os antigos sem
-- motivo a cada update, como a marca de sincronização).
create or replace function public.validar_bloqueio()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.motivo is null then
    raise exception 'Informe o motivo do bloqueio'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Nome começa com "bloqueios_validar": roda depois de "bloqueios_normalizar"
-- (ordem alfabética), com o motivo já limpo (vazio vira NULL).
drop trigger if exists bloqueios_validar on public.bloqueios;
create trigger bloqueios_validar
  before insert on public.bloqueios
  for each row execute function public.validar_bloqueio();
