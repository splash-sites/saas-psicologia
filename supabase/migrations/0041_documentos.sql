-- Documentos do paciente (feedback da psicóloga, decidido em 2026-11-23 e
-- ajustado em 2026-11-24; entrega G). Resolução CFP 01/2009, art. 2º V e VI.
--   * Arquivo no Supabase Storage, bucket privado "documentos", caminho
--     "<psicologa_id>/<documento_id>.<ext>". Abre só por link assinado de 1 min.
--   * Envio direto do navegador para o Storage (a Vercel recusa corpo acima de
--     4,5 MB): o servidor cria antes a linha (confere tipo, tamanho e cota) e o
--     Storage só aceita o arquivo se existir essa linha pendente, da mesma conta.
--   * Só arquivar (deleted_at): guarda de 5 anos. Sem DELETE de linha nem de
--     arquivo (sem policy de delete no Storage).
--   * Cota por conta em app_config.documentos_cota_mb (100 MB no plano grátis do
--     Supabase; subir para 1024 no Pro, sem mudar código).
--   * Abrir um documento grava em acessos_prontuario (tipo 'documento').
--   * "Baixar documentos" do paciente entra no limite de exportação (5/min).
-- Aplicar no SQL Editor de produção ANTES do push. Idempotente.

-- 1. Cota -----------------------------------------------------------------------
alter table public.app_config
  add column if not exists documentos_cota_mb integer not null default 100;
alter table public.app_config drop constraint if exists app_config_documentos_cota_valida;
alter table public.app_config
  add constraint app_config_documentos_cota_valida check (documentos_cota_mb between 1 and 102400);

-- 2. Tabela ---------------------------------------------------------------------
create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  psicologa_id uuid not null default auth.uid()
    references public.psicologas(id) on delete restrict,
  paciente_id uuid not null references public.pacientes(id) on delete restrict,
  evolucao_id uuid references public.evolucoes(id) on delete restrict,
  nome text not null,
  tipo text not null default 'outro',
  data_documento date not null default (now() at time zone 'America/Sao_Paulo')::date,
  finalidade text,
  destinatario text,
  arquivo_path text not null unique,
  mime text not null,
  tamanho bigint not null,
  -- null = linha criada, arquivo ainda não confirmado no Storage.
  enviado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint documentos_nome_valido check (char_length(nome) between 1 and 200),
  constraint documentos_tipo_valido check (tipo in (
    'atestado', 'declaracao', 'laudo', 'encaminhamento', 'documento_paciente', 'outro'
  )),
  constraint documentos_finalidade_tamanho check (finalidade is null or char_length(finalidade) <= 300),
  constraint documentos_destinatario_tamanho check (destinatario is null or char_length(destinatario) <= 200),
  constraint documentos_mime_valido check (mime in (
    'application/pdf', 'image/jpeg', 'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )),
  constraint documentos_tamanho_valido check (tamanho > 0 and tamanho <= 10485760),
  constraint documentos_caminho_da_conta check (arquivo_path like psicologa_id::text || '/%')
);

create index if not exists documentos_paciente_idx
  on public.documentos (psicologa_id, paciente_id, data_documento desc);
create index if not exists documentos_evolucao_idx
  on public.documentos (evolucao_id) where evolucao_id is not null;

drop trigger if exists documentos_updated_at on public.documentos;
create trigger documentos_updated_at
  before update on public.documentos
  for each row execute function public.set_updated_at();

-- Limpeza, campos que não mudam depois de criados, evolução do mesmo paciente
-- e cota da conta. Security definer: lê app_config (sem policy).
create or replace function public.validar_documento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  usado bigint;
  cota bigint;
begin
  new.nome := public.texto_limpo(new.nome);
  new.finalidade := public.texto_limpo(new.finalidade);
  new.destinatario := public.texto_limpo(new.destinatario);

  if tg_op = 'UPDATE' then
    if new.psicologa_id is distinct from old.psicologa_id
      or new.paciente_id is distinct from old.paciente_id
      or new.evolucao_id is distinct from old.evolucao_id
      or new.arquivo_path is distinct from old.arquivo_path
      or new.mime is distinct from old.mime then
      raise exception 'Esses dados do documento não mudam depois de anexado.'
        using errcode = 'check_violation';
    end if;
    -- O envio só é confirmado uma vez.
    if old.enviado_em is not null then
      new.enviado_em := old.enviado_em;
      new.tamanho := old.tamanho;
    end if;
    return new;
  end if;

  if new.evolucao_id is not null and not exists (
    select 1 from public.evolucoes e
    where e.id = new.evolucao_id and e.paciente_id = new.paciente_id
      and e.psicologa_id = new.psicologa_id
  ) then
    raise exception 'Evolução de outro paciente.' using errcode = 'check_violation';
  end if;

  -- Cota: enviados (inclusive arquivados, que ocupam espaço) + pendentes da última hora.
  select coalesce(sum(tamanho), 0) into usado
  from public.documentos
  where psicologa_id = new.psicologa_id
    and (enviado_em is not null or created_at > now() - interval '1 hour');
  select documentos_cota_mb::bigint * 1048576 into cota from public.app_config where id = 1;
  if usado + new.tamanho > coalesce(cota, 104857600) then
    raise exception 'documentos_cota_excedida' using errcode = 'check_violation';
  end if;
  new.enviado_em := null;
  return new;
end;
$$;

drop trigger if exists documentos_validar on public.documentos;
create trigger documentos_validar
  before insert or update on public.documentos
  for each row execute function public.validar_documento();

-- 3. RLS ------------------------------------------------------------------------
alter table public.documentos enable row level security;

drop policy if exists "documentos_select_own" on public.documentos;
create policy "documentos_select_own"
  on public.documentos for select
  using ((select auth.uid()) = psicologa_id);

drop policy if exists "documentos_insert_own" on public.documentos;
create policy "documentos_insert_own"
  on public.documentos for insert
  with check (
    (select auth.uid()) = psicologa_id
    and public.assinatura_permite_escrita(psicologa_id)
    and public.paciente_da_psicologa(paciente_id)
  );

drop policy if exists "documentos_update_own" on public.documentos;
create policy "documentos_update_own"
  on public.documentos for update
  using ((select auth.uid()) = psicologa_id)
  with check (
    (select auth.uid()) = psicologa_id
    and public.assinatura_permite_escrita(psicologa_id)
  );
-- Sem policy de delete: só arquivar.

-- 4. Storage --------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos', 'documentos', false, 10485760,
  array[
    'application/pdf', 'image/jpeg', 'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "documentos_storage_select" on storage.objects;
create policy "documentos_storage_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Só sobe arquivo para uma linha pendente da própria conta (criada pelo servidor).
drop policy if exists "documentos_storage_insert" on storage.objects;
create policy "documentos_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.documentos d
      where d.arquivo_path = storage.objects.name
        and d.psicologa_id = (select auth.uid())
        and d.enviado_em is null
        and d.deleted_at is null
    )
  );
-- Sem update/delete no Storage: o arquivo não é trocado nem apagado.

-- 5. Espaço usado (tela) --------------------------------------------------------
create or replace function public.documentos_espaco()
returns table (usado bigint, cota bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select coalesce(sum(tamanho), 0) from public.documentos
      where psicologa_id = (select auth.uid()) and enviado_em is not null)::bigint,
    (select documentos_cota_mb::bigint * 1048576 from public.app_config where id = 1);
$$;
revoke all on function public.documentos_espaco() from public, anon;
grant execute on function public.documentos_espaco() to authenticated;

-- Espaço do projeto todo, para o /admin (só o servidor).
create or replace function public.admin_espaco_documentos()
returns table (usado bigint, arquivos bigint, contas bigint, cota_conta bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(tamanho), 0)::bigint,
    count(*)::bigint,
    count(distinct psicologa_id)::bigint,
    (select documentos_cota_mb::bigint * 1048576 from public.app_config where id = 1)
  from public.documentos
  where enviado_em is not null;
$$;
revoke all on function public.admin_espaco_documentos() from public, anon, authenticated;
grant execute on function public.admin_espaco_documentos() to service_role;

-- 6. Registro de acesso: abrir documento ----------------------------------------
alter table public.acessos_prontuario
  add column if not exists documento_id uuid references public.documentos(id) on delete restrict;
alter table public.acessos_prontuario drop constraint if exists acessos_prontuario_tipo_check;
alter table public.acessos_prontuario
  add constraint acessos_prontuario_tipo_check check (tipo in ('ficha', 'evolucoes', 'evolucao', 'documento'));
alter table public.acessos_prontuario drop constraint if exists acessos_prontuario_documento_tipo;
alter table public.acessos_prontuario
  add constraint acessos_prontuario_documento_tipo check ((tipo = 'documento') = (documento_id is not null));

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
    and (
      documento_id is null
      or exists (
        select 1 from public.documentos d
        where d.id = documento_id
          and d.paciente_id = acessos_prontuario.paciente_id
          and d.psicologa_id = (select auth.uid())
      )
    )
  );

-- 7. Limite de exportação: "Baixar documentos" do paciente ----------------------
alter table public.exportacoes drop constraint if exists exportacoes_tipo_check;
alter table public.exportacoes
  add constraint exportacoes_tipo_check check (tipo in ('conta', 'prontuario', 'documentos'));

create or replace function public.registrar_exportacao(
  p_tipo text,
  p_paciente_id uuid default null
)
returns boolean
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  limite int := case p_tipo when 'conta' then 1 when 'prontuario' then 10 when 'documentos' then 5 else 0 end;
  recentes int;
begin
  select count(*) into recentes
  from public.exportacoes
  where psicologa_id = (select auth.uid())
    and tipo = p_tipo
    and created_at > now() - interval '1 minute';
  if recentes >= limite then
    return false;
  end if;
  insert into public.exportacoes (psicologa_id, tipo, paciente_id)
  values ((select auth.uid()), p_tipo, p_paciente_id);
  return true;
end;
$$;
