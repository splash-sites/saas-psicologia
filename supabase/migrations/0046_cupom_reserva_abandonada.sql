-- Reserva de cupom de desconto abandonada não ocupa vaga (auditoria de
-- segurança de 2026-11-26).
--
-- Problema: reservar_cupom_desconto() é chamável direto pela API por qualquer
-- conta logada. A reserva (cupom_descontos sem asaas_subscription_id) só era
-- apagada quando a MESMA conta tentava de novo — e validar_cupom_desconto()
-- contava todas as linhas no limite de usos. Com N contas, alguém esgotava um
-- cupom com limite sem assinar nada.
--
-- Agora uma reserva sem assinatura com mais de 10 minutos é abandonada:
--   1. validar_cupom_desconto() não a conta no limite nem como "já usou";
--   2. reservar_cupom_desconto() apaga as abandonadas daquele cupom (de
--      qualquer conta) com a linha do cupom travada, para o /admin também não
--      mostrá-las como uso.
-- Reserva abandonada não tem cobranca (cobrancas_desconto liga pela
-- assinatura), então apagar não perde histórico.

create or replace function public.validar_cupom_desconto(p_psicologa_id uuid, p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cupom public.cupons;
  v_usos int;
begin
  if exists (select 1 from public.cupom_descontos
             where psicologa_id = p_psicologa_id
               and (asaas_subscription_id is not null
                    or created_at >= now() - interval '10 minutes')) then
    return jsonb_build_object('status', 'ja_usou');
  end if;

  select * into v_cupom from public.cupons where codigo = upper(trim(coalesce(p_codigo, '')));
  if not found or not v_cupom.ativo then
    return jsonb_build_object('status', 'invalido');
  end if;
  if v_cupom.tipo <> 'desconto' then
    return jsonb_build_object('status', 'cupom_de_dias');
  end if;
  if v_cupom.valido_ate is not null and v_cupom.valido_ate < current_date then
    return jsonb_build_object('status', 'expirado');
  end if;
  if v_cupom.limite_usos is not null then
    select count(*) into v_usos from public.cupom_descontos
    where cupom_id = v_cupom.id
      and (asaas_subscription_id is not null
           or created_at >= now() - interval '10 minutes');
    if v_usos >= v_cupom.limite_usos then
      return jsonb_build_object('status', 'esgotado');
    end if;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'cupom_id', v_cupom.id,
    'codigo', v_cupom.codigo,
    'desconto_tipo', v_cupom.desconto_tipo,
    'desconto_valor', v_cupom.desconto_valor,
    'desconto_meses', v_cupom.desconto_meses
  );
end;
$$;

revoke all on function public.validar_cupom_desconto(uuid, text) from public, anon, authenticated;
grant execute on function public.validar_cupom_desconto(uuid, text) to service_role;

create or replace function public.reservar_cupom_desconto(p_codigo text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_assinatura public.assinaturas;
  v_resultado jsonb;
  v_id uuid;
  v_cupom_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'sem_sessao');
  end if;
  if (select count(*) from public.cupom_tentativas
      where psicologa_id = v_uid and created_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('status', 'muitas_tentativas');
  end if;

  select * into v_assinatura from public.assinaturas where psicologa_id = v_uid for update;
  if not found
     or (v_assinatura.asaas_subscription_id is not null and v_assinatura.status <> 'cancelada') then
    return jsonb_build_object('status', 'ja_assinou');
  end if;

  -- Reserva que ficou para trás (o servidor caiu entre reservar e criar a
  -- assinatura no Asaas): libera depois de 10 minutos.
  delete from public.cupom_descontos
  where psicologa_id = v_uid
    and asaas_subscription_id is null
    and created_at < now() - interval '10 minutes';
  if exists (select 1 from public.cupom_descontos
             where psicologa_id = v_uid and asaas_subscription_id is null) then
    return jsonb_build_object('status', 'em_andamento');
  end if;

  select id into v_cupom_id
  from public.cupons where codigo = upper(trim(coalesce(p_codigo, ''))) for update;
  -- Com o cupom travado: as reservas abandonadas dele, de qualquer conta,
  -- deixam de existir (não ocupam vaga nem aparecem como uso no /admin).
  if v_cupom_id is not null then
    delete from public.cupom_descontos
    where cupom_id = v_cupom_id
      and asaas_subscription_id is null
      and created_at < now() - interval '10 minutes';
  end if;

  v_resultado := public.validar_cupom_desconto(v_uid, p_codigo);
  if v_resultado ->> 'status' = 'invalido' then
    insert into public.cupom_tentativas (psicologa_id) values (v_uid);
  end if;
  if v_resultado ->> 'status' <> 'ok' then
    return v_resultado - 'cupom_id';
  end if;

  insert into public.cupom_descontos (cupom_id, codigo, psicologa_id, desconto_tipo, desconto_valor, meses_total)
  values (
    (v_resultado ->> 'cupom_id')::uuid,
    v_resultado ->> 'codigo',
    v_uid,
    v_resultado ->> 'desconto_tipo',
    (v_resultado ->> 'desconto_valor')::numeric,
    (v_resultado ->> 'desconto_meses')::int
  )
  returning id into v_id;

  return (v_resultado - 'cupom_id') || jsonb_build_object('reserva_id', v_id);
end;
$$;

revoke all on function public.reservar_cupom_desconto(text) from public, anon;
grant execute on function public.reservar_cupom_desconto(text) to authenticated;
