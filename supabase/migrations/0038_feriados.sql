-- Feriados no calendário (feedback da psicóloga, decidido em 2026-11-23; entrega E).
-- Os feriados são calculados no código (src/lib/feriados.ts): nacionais,
-- estaduais e pontos facultativos (Carnaval, Cinzas, Corpus Christi). Aqui só
-- a preferência da psicóloga:
--   * feriados_uf: estado dos feriados estaduais (vazio = só nacionais; contas
--     antigas ficam vazias);
--   * mostrar_feriados: "Mostrar feriados no calendário" (ligada por padrão).
-- Grava a própria psicóloga (policy psicologas_update_own, como o aviso de
-- termos: preferência de tela, vale também em somente leitura).
-- Aplicar no SQL Editor de produção ANTES do push. Idempotente.

alter table public.psicologas
  add column if not exists feriados_uf text,
  add column if not exists mostrar_feriados boolean not null default true;

alter table public.psicologas drop constraint if exists psicologas_feriados_uf_valida;
alter table public.psicologas
  add constraint psicologas_feriados_uf_valida check (
    feriados_uf is null or feriados_uf in (
      'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
      'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
    )
  );
