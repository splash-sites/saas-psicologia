-- Módulo 2 (retomado): assinatura da psicóloga via Asaas, sem CNPJ por enquanto
-- (cobrança recebida como pessoa física; nota fiscal fica para quando o CNPJ
-- existir — ver CLAUDE.md). Decisões de produto: R$ 49,90/mês, 14 dias de
-- teste grátis a partir do cadastro, sem carência (vencer já restringe), e
-- a restrição é "somente leitura" — nunca bloqueio total, porque a psicóloga
-- precisa poder consultar/exportar o próprio prontuário mesmo inadimplente
-- (guarda obrigatória de 5 anos).

-- Liga/desliga a aplicação da trava de escrita. Começa DESLIGADA: sem isso,
-- qualquer ambiente sem o Asaas configurado (dev, ou antes de você validar a
-- integração) trancaria todo mundo sozinho 14 dias depois do primeiro cadastro.
-- Ativar em produção só depois de confirmar que a assinatura funciona de
-- ponta a ponta: update public.app_config set assinatura_enforcement_ativo = true;
create table public.app_config (
  id smallint primary key default 1 check (id = 1),
  assinatura_enforcement_ativo boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.app_config (id) values (1);

-- RLS ligado e sem nenhuma policy: ninguém lê/escreve via API (anon/authenticated).
-- Só a função abaixo (security definer) e o service_role tocam nesta tabela.
alter table public.app_config enable row level security;

create trigger app_config_set_updated_at
  before update on public.app_config
  for each row execute function public.set_updated_at();

create type public.assinatura_status as enum ('trial', 'ativa', 'atrasada', 'cancelada');

create table public.assinaturas (
  psicologa_id uuid primary key references public.psicologas(id) on delete cascade,
  status public.assinatura_status not null default 'trial',
  valor numeric(10, 2) not null default 49.90,
  trial_fim date not null default (current_date + 14),
  proximo_vencimento date,
  cpf_cnpj text,
  asaas_customer_id text,
  asaas_subscription_id text,
  -- Link da cobrança em aberto (Pix/boleto/cartão hospedado pelo Asaas),
  -- atualizado a cada evento de webhook e na criação da assinatura.
  invoice_url_atual text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assinaturas enable row level security;

-- Só leitura da própria linha. Toda escrita é feita pelo servidor (webhook,
-- ações de assinar/cancelar) via service_role, nunca pelo client autenticado
-- direto — evita a psicóloga "se auto-ativar" editando a própria assinatura.
create policy "assinaturas_select_own"
  on public.assinaturas for select
  using (auth.uid() = psicologa_id);

create trigger assinaturas_set_updated_at
  before update on public.assinaturas
  for each row execute function public.set_updated_at();

-- Auditoria + idempotência dos webhooks recebidos do Asaas. chave_idempotencia
-- evita processar duas vezes o mesmo evento reentregue.
create table public.assinatura_eventos (
  id uuid primary key default gen_random_uuid(),
  psicologa_id uuid references public.psicologas(id) on delete cascade,
  chave_idempotencia text not null unique,
  tipo_evento text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index assinatura_eventos_psicologa_idx on public.assinatura_eventos (psicologa_id);

alter table public.assinatura_eventos enable row level security;

create policy "assinatura_eventos_select_own"
  on public.assinatura_eventos for select
  using (auth.uid() = psicologa_id);

-- Dispara junto com a criação do perfil da psicóloga: toda conta nova já
-- nasce em trial de 14 dias, sem precisar de um passo extra de "ativar".
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.psicologas (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email
  );
  insert into public.assinaturas (psicologa_id) values (new.id);
  return new;
end;
$$;

-- Pode a psicóloga criar/editar dados? Sim se a trava estiver desligada
-- (app_config), ou se a assinatura estiver ativa, ou ainda dentro do trial.
-- security definer: lê app_config mesmo sem policy de select para o client.
create or replace function public.assinatura_permite_escrita(p_psicologa_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select
    not coalesce((select assinatura_enforcement_ativo from public.app_config where id = 1), false)
    or coalesce(
      (
        select status = 'ativa' or (status = 'trial' and trial_fim >= current_date)
        from public.assinaturas
        where psicologa_id = p_psicologa_id
      ),
      -- Sem linha de assinatura (não deveria acontecer, o trigger sempre cria):
      -- nega por segurança em vez de liberar.
      false
    );
$$;

grant execute on function public.assinatura_permite_escrita(uuid) to authenticated;

-- A tela de assinatura precisa saber se a trava está ligada (pra explicar o
-- "somente leitura"), mas app_config não tem policy de select. Exposta à
-- parte porque não é dado sensível — não recebe parâmetro, não vaza nada.
create or replace function public.assinatura_enforcement_ativo()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select assinatura_enforcement_ativo from public.app_config where id = 1), false);
$$;

grant execute on function public.assinatura_enforcement_ativo() to authenticated;

-- Trava de escrita nas tabelas de dado do consultório. Leitura nunca é
-- restringida (retenção obrigatória de prontuário/financeiro).
drop policy "pacientes_insert_own" on public.pacientes;
create policy "pacientes_insert_own"
  on public.pacientes for insert
  with check (auth.uid() = psicologa_id and public.assinatura_permite_escrita(psicologa_id));

drop policy "pacientes_update_own" on public.pacientes;
create policy "pacientes_update_own"
  on public.pacientes for update
  using (auth.uid() = psicologa_id)
  with check (auth.uid() = psicologa_id and public.assinatura_permite_escrita(psicologa_id));

drop policy "anamneses_insert_own" on public.anamneses;
create policy "anamneses_insert_own"
  on public.anamneses for insert
  with check (auth.uid() = psicologa_id and public.assinatura_permite_escrita(psicologa_id));

drop policy "anamneses_update_own" on public.anamneses;
create policy "anamneses_update_own"
  on public.anamneses for update
  using (auth.uid() = psicologa_id)
  with check (auth.uid() = psicologa_id and public.assinatura_permite_escrita(psicologa_id));

drop policy "consultas_insert_own" on public.consultas;
create policy "consultas_insert_own"
  on public.consultas for insert
  with check (auth.uid() = psicologa_id and public.assinatura_permite_escrita(psicologa_id));

drop policy "consultas_update_own" on public.consultas;
create policy "consultas_update_own"
  on public.consultas for update
  using (auth.uid() = psicologa_id)
  with check (auth.uid() = psicologa_id and public.assinatura_permite_escrita(psicologa_id));

drop policy "bloqueios_insert_own" on public.bloqueios;
create policy "bloqueios_insert_own"
  on public.bloqueios for insert
  with check (auth.uid() = psicologa_id and public.assinatura_permite_escrita(psicologa_id));

drop policy "bloqueios_update_own" on public.bloqueios;
create policy "bloqueios_update_own"
  on public.bloqueios for update
  using (auth.uid() = psicologa_id)
  with check (auth.uid() = psicologa_id and public.assinatura_permite_escrita(psicologa_id));

drop policy "bloqueios_delete_own" on public.bloqueios;
create policy "bloqueios_delete_own"
  on public.bloqueios for delete
  using (auth.uid() = psicologa_id and public.assinatura_permite_escrita(psicologa_id));

drop policy "evolucoes_insert_own" on public.evolucoes;
create policy "evolucoes_insert_own"
  on public.evolucoes for insert
  with check (auth.uid() = psicologa_id and public.assinatura_permite_escrita(psicologa_id));

drop policy "evolucoes_update_own" on public.evolucoes;
create policy "evolucoes_update_own"
  on public.evolucoes for update
  using (auth.uid() = psicologa_id)
  with check (auth.uid() = psicologa_id and public.assinatura_permite_escrita(psicologa_id));

drop policy "pagamentos_insert_own" on public.pagamentos;
create policy "pagamentos_insert_own"
  on public.pagamentos for insert
  with check (auth.uid() = psicologa_id and public.assinatura_permite_escrita(psicologa_id));

drop policy "pagamentos_update_own" on public.pagamentos;
create policy "pagamentos_update_own"
  on public.pagamentos for update
  using (auth.uid() = psicologa_id)
  with check (auth.uid() = psicologa_id and public.assinatura_permite_escrita(psicologa_id));
