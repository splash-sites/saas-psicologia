import { timingSafeEqual } from "node:crypto";

// Lógica pura do webhook do Asaas — separada da rota pra poder testar sem
// subir um servidor HTTP de verdade.

/** Comparação resistente a timing attack. Tamanhos diferentes = inválido. */
export function tokenValido(
  recebido: string | null | undefined,
  esperado: string | null | undefined,
): boolean {
  if (!recebido || !esperado) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Chave de deduplicação: o Asaas reentrega o mesmo evento se não confirmarmos rápido. */
export function chaveIdempotencia(
  evento: string,
  paymentId: string,
  status: string | undefined,
): string {
  return `${evento}:${paymentId}:${status ?? ""}`;
}

const EVENTOS_CONFIRMAM_PAGAMENTO = new Set([
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_RECEIVED_IN_CASH",
]);
const EVENTOS_ATRASO = new Set(["PAYMENT_OVERDUE"]);
const STATUS_PAGO = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]);

export type ClasseEvento = "confirma_pagamento" | "atraso" | "ignorar";

export function classificarEvento(evento: string): ClasseEvento {
  if (EVENTOS_CONFIRMAM_PAGAMENTO.has(evento)) return "confirma_pagamento";
  if (EVENTOS_ATRASO.has(evento)) return "atraso";
  return "ignorar";
}

export function statusIndicaPago(status: string | null | undefined): boolean {
  return Boolean(status && STATUS_PAGO.has(status));
}

/** Próxima data de vencimento (mesmo dia, `meses` adiante — 1/3/6 conforme o
 * plano) — usada como estimativa de exibição; quem manda de verdade é sempre
 * o próximo webhook do Asaas. */
export function proximoMesDe(dataISO: string, meses = 1): string {
  const d = new Date(`${dataISO}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + meses);
  return d.toISOString().slice(0, 10);
}
