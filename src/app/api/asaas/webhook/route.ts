import { NextResponse } from "next/server";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { buscarCobranca, asaasModo } from "@/lib/asaas/client";
import {
  tokenValido,
  chaveIdempotencia,
  classificarEvento,
  statusIndicaPago,
  proximoMesDe,
} from "@/lib/asaas/webhook";
import { PLANOS, type AssinaturaPlano } from "@/lib/assinatura/types";

const LIMITE_EVENTOS_POR_MINUTO = 120;

type CorpoWebhook = {
  event?: string;
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
  const { error: erroInsercao } = await admin.from("assinatura_eventos").insert({
    psicologa_id: assinatura?.psicologa_id ?? null,
    chave_idempotencia: chaveIdempotencia(evento, pagamento.id, pagamento.status),
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

  // Nunca libera acesso só porque o corpo do webhook diz "pago" — confirma
  // direto na API do Asaas antes (mitiga um token vazado forjando confirmação).
  let statusReal = pagamento.status;
  if (asaasModo() !== "mock") {
    const cobranca = await buscarCobranca(pagamento.id);
    if (cobranca) statusReal = cobranca.status;
  }

  if (classe === "confirma_pagamento" && statusIndicaPago(statusReal)) {
    const meses = PLANOS[(assinatura.plano ?? "mensal") as AssinaturaPlano].meses;
    await admin
      .from("assinaturas")
      .update({
        status: "ativa",
        proximo_vencimento: pagamento.dueDate ? proximoMesDe(pagamento.dueDate, meses) : null,
        invoice_url_atual: null,
      })
      .eq("psicologa_id", assinatura.psicologa_id);
  } else if (classe === "atraso") {
    await admin
      .from("assinaturas")
      .update({ status: "atrasada", invoice_url_atual: pagamento.invoiceUrl ?? null })
      .eq("psicologa_id", assinatura.psicologa_id);
  }

  return NextResponse.json({ ok: true });
}
