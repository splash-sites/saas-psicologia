export const PRECO_MENSAL = 49.9;
export const DIAS_TRIAL = 14;

export const ASSINATURA_STATUS = ["trial", "ativa", "atrasada", "cancelada"] as const;
export type AssinaturaStatus = (typeof ASSINATURA_STATUS)[number];

export const ASSINATURA_STATUS_LABEL: Record<AssinaturaStatus, string> = {
  trial: "Teste grátis",
  ativa: "Ativa",
  atrasada: "Pagamento atrasado",
  cancelada: "Cancelada",
};

export type Assinatura = {
  psicologa_id: string;
  status: AssinaturaStatus;
  valor: number;
  trial_fim: string;
  proximo_vencimento: string | null;
  cpf_cnpj: string | null;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  invoice_url_atual: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Mesma regra da função assinatura_permite_escrita() no banco — mantidas em
 * sincronia de propósito. A trava de verdade é a do banco (RLS); esta cópia
 * só serve pra UI decidir o que mostrar sem depender de tentativa e erro.
 */
export function permiteEscrita(
  a: Pick<Assinatura, "status" | "trial_fim">,
  enforcementAtivo: boolean,
  hojeISO: string = new Date().toISOString().slice(0, 10),
): boolean {
  if (!enforcementAtivo) return true;
  return a.status === "ativa" || (a.status === "trial" && a.trial_fim >= hojeISO);
}

export function diasRestantesTrial(
  trialFim: string,
  hojeISO: string = new Date().toISOString().slice(0, 10),
): number {
  const diff =
    new Date(`${trialFim}T00:00:00Z`).getTime() - new Date(`${hojeISO}T00:00:00Z`).getTime();
  return Math.ceil(diff / 86_400_000);
}

export function formatarCpfCnpj(digitos: string): string {
  if (digitos.length === 11) {
    return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digitos.length === 14) {
    return digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return digitos;
}
