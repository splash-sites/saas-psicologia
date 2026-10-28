import { randomUUID } from "node:crypto";

// Cliente HTTP fino para a API do Asaas. Fica dormente (modo simulado) até
// ASAAS_API_KEY ser configurada — mesmo padrão usado para o Google Calendar:
// o resto do app funciona sem a integração real, sem travar o desenvolvimento.

export type AsaasModo = "mock" | "sandbox" | "production";

export function asaasModo(): AsaasModo {
  const modo = process.env.ASAAS_MODE?.toLowerCase();
  if (modo === "sandbox" || modo === "production") return modo;
  if (modo === "mock") return "mock";
  // Sem ASAAS_MODE explícito: só roda de verdade se houver chave de API.
  return process.env.ASAAS_API_KEY ? "sandbox" : "mock";
}

export function asaasConfigurada(): boolean {
  return asaasModo() !== "mock";
}

const BASE_URL: Record<Exclude<AsaasModo, "mock">, string> = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
};

/** Erro HTTP da API do Asaas, com o status para quem precisa distinguir 404. */
export class AsaasErro extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
  ) {
    super(mensagem);
  }
}

async function chamar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const modo = asaasModo();
  if (modo === "mock") {
    throw new Error("chamar() não deve ser usado em modo simulado");
  }
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new Error("ASAAS_API_KEY não configurada");

  const res = await fetch(`${BASE_URL[modo]}${caminho}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const corpo = await res.text();
    throw new AsaasErro(`Asaas ${caminho} recusou: ${res.status} ${corpo.slice(0, 300)}`, res.status);
  }
  return res.json() as Promise<T>;
}

export type ClienteAsaas = { id: string };

export async function criarClienteAsaas(dados: {
  nome: string;
  email: string;
  cpfCnpj: string;
}): Promise<ClienteAsaas> {
  if (asaasModo() === "mock") return { id: `mock_cus_${randomUUID()}` };
  return chamar<ClienteAsaas>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: dados.nome,
      email: dados.email,
      cpfCnpj: dados.cpfCnpj.replace(/\D/g, ""),
      // Sem notificações do Asaas (e-mail/SMS/WhatsApp ao cliente): cada
      // cobrança notificada custa a "taxa de mensageria". Decisão do usuário,
      // 2026-10-28.
      notificationDisabled: true,
    }),
  });
}

export type AssinaturaAsaas = { id: string };

export async function criarAssinaturaAsaas(dados: {
  customerId: string;
  valor: number;
  primeiroVencimento: string; // YYYY-MM-DD
  ciclo: "MONTHLY" | "QUARTERLY" | "SEMIANNUALLY";
}): Promise<AssinaturaAsaas> {
  if (asaasModo() === "mock") return { id: `mock_sub_${randomUUID()}` };
  return chamar<AssinaturaAsaas>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      customer: dados.customerId,
      // UNDEFINED = a psicóloga escolhe Pix, boleto ou cartão na página
      // hospedada pelo Asaas; nenhum dado de pagamento passa pelo nosso servidor.
      billingType: "UNDEFINED",
      cycle: dados.ciclo,
      value: dados.valor,
      nextDueDate: dados.primeiroVencimento,
      description: "Assinatura — Gradatim",
    }),
  });
}

export async function cancelarAssinaturaAsaas(subscriptionId: string): Promise<void> {
  if (asaasModo() === "mock") return;
  if (subscriptionId.startsWith("mock_")) return;
  await chamar(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "DELETE",
  });
}

export type CobrancaAsaas = {
  id: string;
  status: string;
  value: number;
  subscription: string | null;
  invoiceUrl: string | null;
  dueDate: string; // YYYY-MM-DD
};

/** Primeira cobrança gerada para a assinatura — dá o link de pagamento. */
export async function primeiraCobrancaDaAssinatura(
  subscriptionId: string,
): Promise<CobrancaAsaas | null> {
  if (asaasModo() === "mock") return null;
  const r = await chamar<{ data: CobrancaAsaas[] }>(
    `/payments?subscription=${encodeURIComponent(subscriptionId)}&limit=1`,
  );
  return r.data[0] ?? null;
}

/**
 * A assinatura foi mesmo removida no Asaas? true/false pela API (404 conta
 * como removida); null se a API não respondeu — aí não dá para confirmar.
 */
export async function assinaturaRemovidaNoAsaas(subscriptionId: string): Promise<boolean | null> {
  if (asaasModo() === "mock") return null;
  try {
    const r = await chamar<{ deleted?: boolean }>(
      `/subscriptions/${encodeURIComponent(subscriptionId)}`,
    );
    return r.deleted === true;
  } catch (e) {
    if (e instanceof AsaasErro && e.status === 404) return true;
    return null;
  }
}

/** Confere o status de uma cobrança direto na API — nunca confiar só no
 * corpo do webhook, que pode ser forjado se o token vazar. */
export async function buscarCobranca(paymentId: string): Promise<CobrancaAsaas | null> {
  if (asaasModo() === "mock") return null;
  try {
    return await chamar<CobrancaAsaas>(`/payments/${encodeURIComponent(paymentId)}`);
  } catch {
    return null;
  }
}
