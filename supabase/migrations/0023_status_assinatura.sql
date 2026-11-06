-- Assinatura da psicóloga logada + estado da trava numa consulta só. O layout
-- do app faz isso a cada página aberta e a cada formulário salvo; antes eram
-- duas requisições (select em assinaturas + rpc assinatura_enforcement_ativo).
--
-- Devolve {"assinatura": <linha ou null>, "enforcement": bool}.
-- security invoker + auth.uid(): só a própria linha, como a policy de select.

create or replace function public.status_assinatura()
returns json
language sql
stable
security invoker
set search_path = public
as $$
  select json_build_object(
    'assinatura', (
      select to_json(a)
      from public.assinaturas a
      where a.psicologa_id = (select auth.uid())
    ),
    'enforcement', public.assinatura_enforcement_ativo()
  );
$$;

revoke all on function public.status_assinatura() from public, anon;
grant execute on function public.status_assinatura() to authenticated;
