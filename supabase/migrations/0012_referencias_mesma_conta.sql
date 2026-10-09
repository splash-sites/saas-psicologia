-- Referências entre tabelas sempre dentro da mesma conta.
--
-- As policies de insert/update só conferiam psicologa_id = auth.uid() na
-- própria linha. A FK de paciente_id/consulta_id não passa pelo RLS, então uma
-- psicóloga com o id de um paciente de outra conta conseguia gravar linhas
-- dela apontando pra ele. Não vazava dado (o select continua filtrado), mas em
-- anamneses — 1:1 por paciente_id — isso ocupava a ficha do paciente alheio e
-- impedia a dona de salvar a própria anamnese.
--
-- Agora toda referência a paciente/consulta precisa ser de um registro da
-- própria psicóloga logada.

create or replace function public.paciente_da_psicologa(p_paciente_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.pacientes
    where id = p_paciente_id and psicologa_id = auth.uid()
  );
$$;

-- consulta_id é opcional em evolucoes/pagamentos: nulo é aceito.
create or replace function public.consulta_da_psicologa(p_consulta_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_consulta_id is null or exists (
    select 1 from public.consultas
    where id = p_consulta_id and psicologa_id = auth.uid()
  );
$$;

grant execute on function public.paciente_da_psicologa(uuid) to authenticated;
grant execute on function public.consulta_da_psicologa(uuid) to authenticated;

-- anamneses
drop policy "anamneses_insert_own" on public.anamneses;
create policy "anamneses_insert_own"
  on public.anamneses for insert
  with check (
    auth.uid() = psicologa_id
    and public.assinatura_permite_escrita(psicologa_id)
    and public.paciente_da_psicologa(paciente_id)
  );

drop policy "anamneses_update_own" on public.anamneses;
create policy "anamneses_update_own"
  on public.anamneses for update
  using (auth.uid() = psicologa_id)
  with check (
    auth.uid() = psicologa_id
    and public.assinatura_permite_escrita(psicologa_id)
    and public.paciente_da_psicologa(paciente_id)
  );

-- consultas
drop policy "consultas_insert_own" on public.consultas;
create policy "consultas_insert_own"
  on public.consultas for insert
  with check (
    auth.uid() = psicologa_id
    and public.assinatura_permite_escrita(psicologa_id)
    and public.paciente_da_psicologa(paciente_id)
  );

drop policy "consultas_update_own" on public.consultas;
create policy "consultas_update_own"
  on public.consultas for update
  using (auth.uid() = psicologa_id)
  with check (
    auth.uid() = psicologa_id
    and public.assinatura_permite_escrita(psicologa_id)
    and public.paciente_da_psicologa(paciente_id)
  );

-- evolucoes
drop policy "evolucoes_insert_own" on public.evolucoes;
create policy "evolucoes_insert_own"
  on public.evolucoes for insert
  with check (
    auth.uid() = psicologa_id
    and public.assinatura_permite_escrita(psicologa_id)
    and public.paciente_da_psicologa(paciente_id)
    and public.consulta_da_psicologa(consulta_id)
  );

drop policy "evolucoes_update_own" on public.evolucoes;
create policy "evolucoes_update_own"
  on public.evolucoes for update
  using (auth.uid() = psicologa_id)
  with check (
    auth.uid() = psicologa_id
    and public.assinatura_permite_escrita(psicologa_id)
    and public.paciente_da_psicologa(paciente_id)
    and public.consulta_da_psicologa(consulta_id)
  );

-- pagamentos
drop policy "pagamentos_insert_own" on public.pagamentos;
create policy "pagamentos_insert_own"
  on public.pagamentos for insert
  with check (
    auth.uid() = psicologa_id
    and public.assinatura_permite_escrita(psicologa_id)
    and public.paciente_da_psicologa(paciente_id)
    and public.consulta_da_psicologa(consulta_id)
  );

drop policy "pagamentos_update_own" on public.pagamentos;
create policy "pagamentos_update_own"
  on public.pagamentos for update
  using (auth.uid() = psicologa_id)
  with check (
    auth.uid() = psicologa_id
    and public.assinatura_permite_escrita(psicologa_id)
    and public.paciente_da_psicologa(paciente_id)
    and public.consulta_da_psicologa(consulta_id)
  );

-- lembretes (consulta_id é obrigatório aqui)
drop policy "lembretes_insert_own" on public.lembretes;
create policy "lembretes_insert_own"
  on public.lembretes for insert
  with check (
    auth.uid() = psicologa_id
    and consulta_id is not null
    and public.consulta_da_psicologa(consulta_id)
  );

drop policy "lembretes_update_own" on public.lembretes;
create policy "lembretes_update_own"
  on public.lembretes for update
  using (auth.uid() = psicologa_id)
  with check (
    auth.uid() = psicologa_id
    and consulta_id is not null
    and public.consulta_da_psicologa(consulta_id)
  );
