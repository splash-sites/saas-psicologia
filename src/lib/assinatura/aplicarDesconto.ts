import type { SupabaseClient } from "@supabase/supabase-js";
import { atualizarValorCobranca, type CobrancaAsaas } from "@/lib/asaas/client";
import { funcaoAusente } from "./guard";
import { PLANOS, type AssinaturaPlano } from "./types";
import { descontoDaLinha, valorComDesconto } from "./desconto";

export type ResultadoDesconto =
  | { tipo: "aplicado"; valor: number }
  // Sem cupom, cupom para sempre (a assinatura já tem o valor menor), meses
  // acabaram, ou esta cobrança já recebeu o desconto.
  | { tipo: "nada"; jaAplicado: boolean }
  // O Asaas recusou a troca de valor: a reserva dos meses foi desfeita.
  | { tipo: "falhou" };

type Reserva = {
  status: "ok" | "sem_desconto" | "permanente" | "esgotado" | "ja_aplicado";
  meses?: number;
  desconto_tipo?: string;
  desconto_valor?: number;
};

/**
 * Desconto do cupom (migration 0031) numa cobrança da assinatura: o banco
 * reserva os meses que cabem nela (uma vez por cobrança) e o Asaas recebe o
 * valor novo. `admin` = cliente com a service role.
 */
export async function aplicarDescontoNaCobranca(
  admin: SupabaseClient,
  dados: {
    subscriptionId: string;
    plano: AssinaturaPlano;
    cobranca: Pick<CobrancaAsaas, "id" | "billingType" | "dueDate"> & { value?: number };
  },
): Promise<ResultadoDesconto> {
  const { data, error } = await admin.rpc("reservar_meses_desconto", {
    p_subscription_id: dados.subscriptionId,
    p_payment_id: dados.cobranca.id,
    p_meses_plano: PLANOS[dados.plano].meses,
  });
  // Sem a migration aplicada, segue sem desconto (não há cupom de desconto
  // nenhum nesse caso).
  if (funcaoAusente(error)) return { tipo: "nada", jaAplicado: false };
  if (error) throw new Error(`reservar_meses_desconto: ${error.message}`);

  const reserva = data as Reserva;
  if (reserva.status !== "ok" || !reserva.meses || !reserva.desconto_tipo) {
    return { tipo: "nada", jaAplicado: reserva.status === "ja_aplicado" };
  }

  const valor = valorComDesconto(
    dados.plano,
    descontoDaLinha({ desconto_tipo: reserva.desconto_tipo, desconto_valor: reserva.desconto_valor ?? 0 }),
    reserva.meses,
  );

  try {
    await atualizarValorCobranca(dados.cobranca, valor);
  } catch {
    await admin.rpc("devolver_meses_desconto", { p_payment_id: dados.cobranca.id });
    return { tipo: "falhou" };
  }

  await admin
    .from("cobrancas_desconto")
    .update({ valor_original: dados.cobranca.value ?? PLANOS[dados.plano].valor, valor_cobrado: valor })
    .eq("asaas_payment_id", dados.cobranca.id);

  return { tipo: "aplicado", valor };
}
