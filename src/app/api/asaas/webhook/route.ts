import { NextResponse } from "next/server";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { buscarCobranca, asaasModo, assinaturaRemovidaNoAsaas } from "@/lib/asaas/client";
import {
  tokenValido,
  chaveIdempotencia,
  classificarEvento,
  statusIndicaPago,
  statusIndicaEstorno,
  statusChargebackRevertido,
  cobrancaDoPeriodoAtual,
  proximoMesDe,
  verificarCobranca,
} from "@/lib/asaas/webhook";
import { PLANOS, type AssinaturaPlano } from "@/lib/assinatura/types";

const LIMITE_EVENTOS_POR_MINUTO = 120;

type CorpoWebhook = {
  event?: string;
  subscription?: { id?: string; deleted?: boolean };
  payment?: {
    id?: string;
    subscription?: string;
    status?: string;
    dueDate?: string;
    invoiceUrl?: string;
  };
};

export async function POST(request: Request) {
  if (!adminDisponivel()) {
    return NextResponse.json({ error: "indisponível" }, { status: 503 });
  }

  // Assinatura por token: o Asaas não faz HMAC do corpo, só reenvia de volta
  // o token cadastrado no painel dele. Comparação resistente a timing attack.
  if (!tokenValido(request.headers.get("asaas-access-token"), process.env.ASAAS_WEBHOOK_TOKEN)) {
    return NextResponse.json({ error: "token inválido" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Rate limit via banco (não memória do processo — precisa funcionar entre
  // instâncias serverless). Grosseiro de propósito: só pra conter abuso.
  const umMinutoAtras = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin
    .from("assinatura_eventos")
    .select("id", { count: "exact", head: true })
    .gte("created_at", umMinutoAtras);
  if ((count ?? 0) > LIMITE_EVENTOS_POR_MINUTO) {
    return NextResponse.json({ error: "limite excedido" }, { status: 429 });
  }

  let corpo: CorpoWebhook;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ error: "corpo inválido" }, { status: 400 });
  }

  const evento = corpo.event;
  if (evento === "SUBSCRIPTION_DELETED") {
    return assinaturaRemovida(admin, corpo);
  }
  const pagamento = corpo.payment;
  if (!evento || !pagamento?.id) {
    return NextResponse.json({ ok: true });
  }

  const { data: assinatura } = await admin
    .from("assinaturas")
    .select("psicologa_id, plano")
    .eq("asaas_subscription_id", pagamento.subscription ?? "")
    .maybeSingle();

  // Idempotência: grava o evento antes de agir. Reentrega do mesmo evento
  // colide na unique constraint e sai sem reprocessar.
  const chave = chaveIdempotencia(evento, pagamento.id, pagamento.status);
  const { error: erroInsercao } = await admin.from("assinatura_eventos").insert({
    psicologa_id: assinatura?.psicologa_id ?? null,
    chave_idempotencia: chave,
    tipo_evento: evento,
    payload: corpo,
  });
  if (erroInsercao) {
    if (erroInsercao.code === "23505") return NextResponse.json({ ok: true }); // já visto
    return NextResponse.json({ error: "falha ao registrar" }, { status: 500 });
  }

  if (!assinatura) {
    // Cobrança de uma assinatura que não reconhecemos: só fica no log.
    return NextResponse.json({ ok: true });
  }

  const classe = classificarEvento(evento);
  if (classe === "ignorar") return NextResponse.json({ ok: true });

  // Nunca muda a assinatura só pelo que o corpo do webhook diz — confirma
  // direto na API do Asaas antes (mitiga um token vazado forjando eventos).
  const modo = asaasModo();
  const cobranca = modo === "mock" ? null : await buscarCobranca(pagamento.id);
  const verificacao = verificarCobranca(
    modo,
    pagamento.status,
    cobranca,
    pagamento.subscription ?? "",
  );
  if (verificacao.tipo === "indisponivel") {
    // Libera a chave pra reentrega do Asaas ser processada de novo, e
    // responde erro pra ele de fato reenviar.
    await admin.from("assinatura_eventos").delete().eq("chave_idempotencia", chave);
    return NextResponse.json({ error: "não foi possível confirmar no Asaas" }, { status: 503 });
  }
  if (verificacao.tipo === "divergente") {
    // Fica só no log; reenviar não mudaria nada.
    return NextResponse.json({ ok: true });
  }
  const statusReal = verificacao.status;

  if (classe === "confirma_pagamento" && statusIndicaPago(statusReal)) {
    const meses = PLANOS[(assinatura.plano ?? "mensal") as AssinaturaPlano].meses;
    await admin
      .from("assinaturas")
      .update({
        status: "ativa",
        proximo_vencimento: pagamento.dueDate ? proximoMesDe(pagamento.dueDate, meses) : null,
      })
      .eq("psicologa_id", assinatura.psicologa_id);
    // Só apaga o link se for o desta cobrança: a do próximo ciclo pode já ter
    // sido gerada (PAYMENT_CREATED) antes deste aviso chegar.
    const linkPago = cobranca?.invoiceUrl ?? pagamento.invoiceUrl;
    if (linkPago) {
      await admin
        .from("assinaturas")
        .update({ invoice_url_atual: null })
        .eq("psicologa_id", assinatura.psicologa_id)
        .eq("invoice_url_atual", linkPago);
    }
  } else if (classe === "cobranca_em_aberto" && (modo === "mock" || statusReal === "PENDING")) {
    // Link e vencimento vêm da API (mock: do corpo), nunca só do corpo.
    const link = modo === "mock" ? pagamento.invoiceUrl : cobranca?.invoiceUrl;
    const vencimento = modo === "mock" ? pagamento.dueDate : cobranca?.dueDate;
    if (link && vencimento) {
      await admin
        .from("assinaturas")
        .update({ invoice_url_atual: link, proximo_vencimento: vencimento })
        .eq("psicologa_id", assinatura.psicologa_id);
    }
  } else if (classe === "estorno") {
    const meses = PLANOS[(assinatura.plano ?? "mensal") as AssinaturaPlano].meses;
    const vencimento = modo === "mock" ? pagamento.dueDate : cobranca?.dueDate;
    if (vencimento && cobrancaDoPeriodoAtual(vencimento, meses)) {
      if (statusIndicaEstorno(statusReal)) {
        // Somente leitura na hora (decisão do usuário, 2026-10-28). Ativa vira
        // atrasada; cancelada perde o resto do período pago.
        await admin
          .from("assinaturas")
          .update({ status: "atrasada" })
          .eq("psicologa_id", assinatura.psicologa_id)
          .eq("status", "ativa");
        await admin
          .from("assinaturas")
          .update({ proximo_vencimento: null })
          .eq("psicologa_id", assinatura.psicologa_id)
          .eq("status", "cancelada");
      } else if (statusChargebackRevertido(statusReal)) {
        // Disputa ganha: só desfaz o bloqueio que o próprio estorno causou.
        await admin
          .from("assinaturas")
          .update({ status: "ativa", proximo_vencimento: proximoMesDe(vencimento, meses) })
          .eq("psicologa_id", assinatura.psicologa_id)
          .eq("status", "atrasada");
      }
    }
  } else if (classe === "atraso" && (modo === "mock" || statusReal === "OVERDUE")) {
    await admin
      .from("assinaturas")
      .update({ status: "atrasada", invoice_url_atual: pagamento.invoiceUrl ?? null })
      .eq("psicologa_id", assinatura.psicologa_id);
  }

  return NextResponse.json({ ok: true });
}

/**
 * Assinatura removida no painel do Asaas (por fora do app): mesmo efeito do
 * botão "Cancelar assinatura" — cancelada, com acesso até o fim do período
 * pago. Quando o cancelamento é pelo app, o Asaas também avisa; repetir é inócuo.
 */
async function assinaturaRemovida(
  admin: ReturnType<typeof createAdminClient>,
  corpo: CorpoWebhook,
) {
  const id = corpo.subscription?.id;
  if (!id) return NextResponse.json({ ok: true });

  const { data: assinatura } = await admin
    .from("assinaturas")
    .select("psicologa_id")
    .eq("asaas_subscription_id", id)
    .maybeSingle();

  const chave = chaveIdempotencia("SUBSCRIPTION_DELETED", id, undefined);
  const { error: erroInsercao } = await admin.from("assinatura_eventos").insert({
    psicologa_id: assinatura?.psicologa_id ?? null,
    chave_idempotencia: chave,
    tipo_evento: "SUBSCRIPTION_DELETED",
    payload: corpo,
  });
  if (erroInsercao) {
    if (erroInsercao.code === "23505") return NextResponse.json({ ok: true });
    return NextResponse.json({ error: "falha ao registrar" }, { status: 500 });
  }
  if (!assinatura) return NextResponse.json({ ok: true });

  // Confirma na API antes de cancelar (mock: confia no corpo).
  const removida =
    asaasModo() === "mock" ? corpo.subscription?.deleted !== false : await assinaturaRemovidaNoAsaas(id);
  if (removida === null) {
    await admin.from("assinatura_eventos").delete().eq("chave_idempotencia", chave);
    return NextResponse.json({ error: "não foi possível confirmar no Asaas" }, { status: 503 });
  }
  if (removida) {
    await admin
      .from("assinaturas")
      .update({ status: "cancelada", invoice_url_atual: null })
      .eq("psicologa_id", assinatura.psicologa_id)
      .neq("status", "cancelada");
  }
  return NextResponse.json({ ok: true });
}
