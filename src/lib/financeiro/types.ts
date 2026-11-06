import { hojeBR } from "@/lib/agenda/datas";

export const PAGAMENTO_STATUS = ["pendente", "pago"] as const;
export type PagamentoStatus = (typeof PAGAMENTO_STATUS)[number];

// Estado exibido: deriva "atrasado" de pendente + vencimento no passado.
export type StatusExibicao = "pago" | "pendente" | "atrasado";

export const STATUS_EXIBICAO_LABEL: Record<StatusExibicao, string> = {
  pago: "Pago",
  pendente: "Pendente",
  atrasado: "Atrasado",
};

// Forma de pagamento em lista fixa (migration 0024): antes era texto livre e
// "Pix", "pix" e "PIX " viravam três formas diferentes.
export const FORMAS_PAGAMENTO = [
  "pix",
  "dinheiro",
  "cartao_credito",
  "cartao_debito",
  "transferencia",
  "boleto",
  "outro",
] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

export const FORMA_PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  transferencia: "Transferência",
  boleto: "Boleto",
  outro: "Outro",
};

/** Rótulo para exibição; valor desconhecido aparece como veio. */
export function rotuloFormaPagamento(v: string | null | undefined): string | null {
  if (!v) return null;
  return FORMA_PAGAMENTO_LABEL[v as FormaPagamento] ?? v;
}

export type Pagamento = {
  id: string;
  psicologa_id: string;
  paciente_id: string;
  consulta_id: string | null;
  valor: number;
  status: PagamentoStatus;
  data_referencia: string;
  vencimento: string;
  data_pagamento: string | null;
  forma_pagamento: FormaPagamento | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function statusExibicao(
  p: Pick<Pagamento, "status" | "vencimento">,
  hojeISO: string = hojeBR(),
): StatusExibicao {
  if (p.status === "pago") return "pago";
  return p.vencimento < hojeISO ? "atrasado" : "pendente";
}

export function formatarBRL(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}
