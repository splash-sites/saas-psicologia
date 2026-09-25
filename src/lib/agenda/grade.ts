// Cálculos da grade semanal da agenda: estado visual de cada consulta,
// faixa de horas exibida e colunas para itens que se sobrepõem no mesmo dia.
// Tudo puro (sem Supabase/React) para ser testável.

import type { ConsultaStatus } from "./types";

export type EstadoVisual =
  | "confirmada" // agendada, futura, paciente confirmou
  | "a_confirmar" // agendada, futura, sem confirmação
  | "encerrada" // agendada que já passou sem ser marcada como realizada/falta
  | "realizada"
  | "falta"
  | "cancelada";

export const ESTADO_VISUAL_LABEL: Record<EstadoVisual, string> = {
  confirmada: "Confirmada",
  a_confirmar: "A confirmar",
  encerrada: "Encerrada",
  realizada: "Realizada",
  falta: "Faltou",
  cancelada: "Cancelada",
};

export function estadoVisual(
  c: { status: ConsultaStatus; confirmada_em: string | null; fim: string },
  agora: Date,
): EstadoVisual {
  if (c.status !== "agendada") return c.status;
  if (new Date(c.fim).getTime() <= agora.getTime()) return "encerrada";
  return c.confirmada_em ? "confirmada" : "a_confirmar";
}

/** Sessão que exige registro de evolução (aconteceu ou deveria ter acontecido). */
export function exigeEvolucao(
  c: { status: ConsultaStatus; fim: string },
  agora: Date,
): boolean {
  if (c.status === "cancelada" || c.status === "falta") return false;
  return new Date(c.fim).getTime() <= agora.getTime();
}

const FMT_HM = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "America/Sao_Paulo",
});

/** Minutos desde a meia-noite (Brasília) do instante `iso`. */
export function minutosNoDiaBR(iso: string): number {
  const [h, m] = FMT_HM.format(new Date(iso)).split(":").map(Number);
  return h * 60 + m;
}

/**
 * Faixa de horas inteiras exibida na grade. Começa no expediente padrão e
 * abre para caber qualquer item mais cedo/mais tarde. Um item que termina à
 * meia-noite (ou vira o dia) estende até 24.
 */
export function faixaDeHoras(
  itens: { inicio: string; fim: string }[],
  padrao: { de: number; ate: number } = { de: 8, ate: 20 },
): { de: number; ate: number } {
  let de = padrao.de;
  let ate = padrao.ate;
  for (const it of itens) {
    const ini = minutosNoDiaBR(it.inicio);
    let fim = minutosNoDiaBR(it.fim);
    const duracao = new Date(it.fim).getTime() - new Date(it.inicio).getTime();
    if (fim <= ini || duracao >= 86_400_000) fim = 24 * 60;
    de = Math.min(de, Math.floor(ini / 60));
    ate = Math.max(ate, Math.ceil(fim / 60));
  }
  return { de, ate: Math.min(ate, 24) };
}

/**
 * Distribui itens de um mesmo dia em colunas lado a lado quando se sobrepõem
 * (ex.: uma consulta cancelada no mesmo horário de outra ativa). Itens que não
 * se cruzam com nenhum outro ficam com a largura toda (total = 1).
 */
export function colunasSobrepostas<T extends { id: string; inicio: string; fim: string }>(
  itens: T[],
): Map<string, { coluna: number; total: number }> {
  const ordenados = [...itens].sort(
    (a, b) =>
      new Date(a.inicio).getTime() - new Date(b.inicio).getTime() ||
      new Date(b.fim).getTime() - new Date(a.fim).getTime(),
  );
  const out = new Map<string, { coluna: number; total: number }>();

  // Agrupa em "clusters" de itens que se tocam em cadeia; em cada cluster,
  // cada item vai para a primeira coluna livre.
  let cluster: { id: string; coluna: number }[] = [];
  let fimColunas: number[] = [];
  let fimCluster = -Infinity;

  const fechar = () => {
    for (const c of cluster) out.set(c.id, { coluna: c.coluna, total: fimColunas.length });
    cluster = [];
    fimColunas = [];
  };

  for (const it of ordenados) {
    const ini = new Date(it.inicio).getTime();
    const fim = new Date(it.fim).getTime();
    if (ini >= fimCluster) fechar();
    let col = fimColunas.findIndex((f) => f <= ini);
    if (col === -1) {
      col = fimColunas.length;
      fimColunas.push(fim);
    } else {
      fimColunas[col] = fim;
    }
    cluster.push({ id: it.id, coluna: col });
    fimCluster = Math.max(fimCluster, fim);
  }
  fechar();
  return out;
}
