// Situação de um lançamento para a tela (redesenho do Financeiro, 2026-11-25,
// decisão do usuário): o banco continua só com pendente/pago; "atrasado" é
// pendente com vencimento passado, e agora diz há quanto tempo, contado do
// VENCIMENTO (na cobrança mensal a sessão de 03/11 vence em 10/12 — antes
// disso é "A vencer", não atraso). A cor segue a idade do atraso.

export type TomSituacao = "pago" | "recente" | "medio" | "antigo" | "neutro";

export type Situacao = {
  tipo: "pago" | "atrasado" | "vence_hoje" | "a_vencer";
  texto: string;
  tom: TomSituacao;
  /** Dias de atraso (só em "atrasado"). */
  dias?: number;
};

/** Pílula: fundo, borda e texto (cores do canvas "Financeiro"). */
export const CLASSE_TOM: Record<TomSituacao, string> = {
  pago: "border-[#B9E0D8] bg-[#DCF0EC] text-[#0B3F3A]",
  recente: "border-[#EBD49A] bg-[#FBF2DC] text-[#5C460F]",
  medio: "border-[#F1C2A8] bg-[#FCE6DA] text-[#7A2A0A]",
  antigo: "border-[#F5C6D7] bg-[#FCE7EF] text-[#8A1F4C]",
  neutro: "border-[#DDE6E3] bg-[#EEF2F1] text-[#3D524D]",
};

const DIA_MS = 86_400_000;

/** Dias entre duas datas AAAA-MM-DD (b − a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DIA_MS);
}

/** "22/09"; de outro ano que o de `hoje`, "22/09/25". */
export function diaMes(iso: string, hoje: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}${iso.slice(0, 4) === hoje.slice(0, 4) ? "" : `/${iso.slice(2, 4)}`}`;
}

/** "1 dia", "22 dias", "3 meses", "5 anos". */
export function idade(dias: number): string {
  if (dias < 60) return `${dias} ${dias === 1 ? "dia" : "dias"}`;
  if (dias < 365) return `${Math.floor(dias / 30)} meses`;
  const anos = Math.floor(dias / 365);
  return `${anos} ${anos === 1 ? "ano" : "anos"}`;
}

/** Até 30 dias, 31 a 90, mais de 90. */
export function tomDoAtraso(dias: number): TomSituacao {
  return dias <= 30 ? "recente" : dias <= 90 ? "medio" : "antigo";
}

export function situacaoLancamento(
  p: { status: "pendente" | "pago"; vencimento: string; data_pagamento: string | null },
  hoje: string,
): Situacao {
  if (p.status === "pago") {
    return { tipo: "pago", texto: p.data_pagamento ? `Pago em ${diaMes(p.data_pagamento, hoje)}` : "Pago", tom: "pago" };
  }
  if (p.vencimento < hoje) {
    const dias = diasEntre(p.vencimento, hoje);
    return { tipo: "atrasado", texto: `Atrasado há ${idade(dias)}`, tom: tomDoAtraso(dias), dias };
  }
  if (p.vencimento === hoje) return { tipo: "vence_hoje", texto: "Vence hoje", tom: "neutro" };
  return { tipo: "a_vencer", texto: `A vencer em ${diaMes(p.vencimento, hoje)}`, tom: "neutro" };
}
