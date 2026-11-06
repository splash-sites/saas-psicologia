import type { SupabaseClient } from "@supabase/supabase-js";
import { funcaoAusente } from "@/lib/assinatura/guard";

export type ResumoFinanceiroMes = { recebido: number; aReceber: number; atrasados: number };

/**
 * Recebido no mês, a receber no mês e quantidade de atrasados, numa consulta só
 * (rpc resumo_financeiro_mes, migration 0022). Enquanto a migration não estiver
 * no banco, faz as três consultas de antes.
 */
export async function resumoFinanceiroMes(
  supabase: SupabaseClient,
  inicio: string,
  fim: string,
  hoje: string,
): Promise<ResumoFinanceiroMes> {
  const { data, error } = await supabase
    .rpc("resumo_financeiro_mes", { p_inicio: inicio, p_fim: fim, p_hoje: hoje })
    .maybeSingle();
  if (!funcaoAusente(error)) {
    const r = (data ?? {}) as { recebido?: number | string; a_receber?: number | string; atrasados?: number };
    return {
      recebido: Number(r.recebido ?? 0),
      aReceber: Number(r.a_receber ?? 0),
      atrasados: Number(r.atrasados ?? 0),
    };
  }

  const [{ data: pagos }, { data: pendentes }, { count }] = await Promise.all([
    supabase
      .from("pagamentos")
      .select("valor")
      .is("deleted_at", null)
      .eq("status", "pago")
      .gte("data_pagamento", inicio)
      .lte("data_pagamento", fim),
    supabase
      .from("pagamentos")
      .select("valor")
      .is("deleted_at", null)
      .eq("status", "pendente")
      .gte("vencimento", inicio)
      .lte("vencimento", fim),
    supabase
      .from("pagamentos")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("status", "pendente")
      .lt("vencimento", hoje),
  ]);
  const soma = (l: { valor: number | string }[] | null) =>
    (l ?? []).reduce((s, r) => s + Number(r.valor), 0);
  return { recebido: soma(pagos), aReceber: soma(pendentes), atrasados: count ?? 0 };
}
