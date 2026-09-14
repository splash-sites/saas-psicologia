export const PAGAMENTO_STATUS = ["pendente", "pago"] as const;
export type PagamentoStatus = (typeof PAGAMENTO_STATUS)[number];

// Estado exibido: deriva "atrasado" de pendente + vencimento no passado.
export type StatusExibicao = "pago" | "pendente" | "atrasado";

export const STATUS_EXIBICAO_LABEL: Record<StatusExibicao, string> = {
  pago: "Pago",
  pendente: "Pendente",
  atrasado: "Atrasado",
};

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
  forma_pagamento: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function statusExibicao(
  p: Pick<Pagamento, "status" | "vencimento">,
  hojeISO: string = new Date().toISOString().slice(0, 10),
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
