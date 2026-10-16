-- Assinatura cancelada mantém a escrita até o fim do período já pago.
--
-- Antes, cancelar marcava status = 'cancelada' e, com a trava ligada, a conta
-- caía em somente leitura na hora — quem pagou o mês e cancelou no dia 3
-- perdia o resto do mês. Agora a cancelada escreve até proximo_vencimento
-- (fim do período pago no Asaas) ou até o fim do teste, o que for mais tarde.
-- greatest() ignora NULL: cancelada sem cobrança nenhuma usa só o trial_fim.
--
-- Mesma regra em src/lib/assinatura/types.ts (permiteEscrita).

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
        select status = 'ativa'
          or (status = 'trial' and trial_fim >= current_date)
          or (status = 'cancelada' and greatest(proximo_vencimento, trial_fim) >= current_date)
        from public.assinaturas
        where psicologa_id = p_psicologa_id
      ),
      -- Sem linha de assinatura (não deveria acontecer, o trigger sempre cria):
      -- nega por segurança em vez de liberar.
      false
    );
$$;
