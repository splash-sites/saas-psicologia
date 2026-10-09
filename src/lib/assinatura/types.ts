export const PRECO_MENSAL = 49.9;
export const DIAS_TRIAL = 14;

export const ASSINATURA_PLANO = ["mensal", "trimestral", "semestral"] as const;
export type AssinaturaPlano = (typeof ASSINATURA_PLANO)[number];

/**
 * Ciclo Asaas de cada plano — precisa bater com os valores aceitos pela API
 * (`cycle` em /subscriptions). Valor cobrado de uma vez no ciclo (não por
 * mês): trimestral e semestral têm desconto sobre 3x/6x o preço mensal.
 */
export const PLANOS: Record<
  AssinaturaPlano,
  { label: string; valor: number; meses: number; cicloAsaas: "MONTHLY" | "QUARTERLY" | "SEMIANNUALLY"; economia?: string }
> = {
  mensal: { label: "Mensal", valor: 49.9, meses: 1, cicloAsaas: "MONTHLY" },
  trimestral: {
    label: "Trimestral",
    valor: 134.73, // 3 × 49,90 com 10% de desconto
    meses: 3,
    cicloAsaas: "QUARTERLY",
    economia: "10% off (R$44,91/mês)",
  },
  semestral: {
    label: "Semestral",
    valor: 254.49, // 6 × 49,90 com 15% de desconto
    meses: 6,
    cicloAsaas: "SEMIANNUALLY",
    economia: "15% off (R$42,42/mês)",
  },
};

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
  plano: AssinaturaPlano;
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

/** Status "trial" com a data já passada: o banco não muda o status sozinho. */
export function trialEncerrado(
  a: Pick<Assinatura, "status" | "trial_fim">,
  hojeISO: string = new Date().toISOString().slice(0, 10),
): boolean {
  return a.status === "trial" && a.trial_fim < hojeISO;
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
