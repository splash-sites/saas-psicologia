import type { Recorrencia } from "./types";

// MVP mono-país: horários são interpretados no fuso de Brasília.
// O Brasil não usa horário de verão desde 2019, então o offset é fixo -03:00.
// Se o produto for atender outros fusos no futuro, trocar por tz real (ex: Temporal / date-fns-tz).
export const BR_OFFSET = "-03:00";

/** Combina data (YYYY-MM-DD) e hora (HH:MM) do formulário num Date UTC. */
export function brWallTimeToDate(data: string, hora: string): Date {
  return new Date(`${data}T${hora}:00${BR_OFFSET}`);
}

/** Segunda-feira (00:00 BRT) da semana que contém `ref`, como YYYY-MM-DD. */
export function segundaDaSemana(ref: Date = new Date()): string {
  const d = new Date(ref);
  // getUTCDay em relação ao wall time BRT: desloca para BRT antes de calcular.
  const brt = new Date(d.getTime() + tzMinutes() * 60000);
  const dow = brt.getUTCDay(); // 0 = domingo
  const diff = dow === 0 ? -6 : 1 - dow;
  brt.setUTCDate(brt.getUTCDate() + diff);
  return brt.toISOString().slice(0, 10);
}

function tzMinutes(): number {
  // -03:00 => -180
  const sign = BR_OFFSET.startsWith("-") ? -1 : 1;
  const [h, m] = BR_OFFSET.slice(1).split(":").map(Number);
  return sign * (h * 60 + m);
}

/** Os 7 dias (YYYY-MM-DD) a partir de uma segunda-feira. */
export function diasDaSemana(segunda: string): string[] {
  const base = new Date(`${segunda}T00:00:00${BR_OFFSET}`);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export function addDias(dataISO: string, dias: number): string {
  const d = new Date(`${dataISO}T00:00:00${BR_OFFSET}`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Início (inclusive) e fim (exclusivo) do dia BRT `dataISO`, em ISO UTC. */
export function intervaloDiaBR(dataISO: string): { inicio: string; fim: string } {
  return {
    inicio: new Date(`${dataISO}T00:00:00${BR_OFFSET}`).toISOString(),
    fim: new Date(`${addDias(dataISO, 1)}T00:00:00${BR_OFFSET}`).toISOString(),
  };
}

/** Dia (BRT) em que cai "agora + antecedência" — o dia dos lembretes a enviar. */
export function diaAlvoLembrete(agora: Date, antecedenciaHoras: number): string {
  return dataChaveBR(new Date(agora.getTime() + antecedenciaHoras * 3600_000).toISOString());
}

/**
 * Gera os pares início/fim de uma série recorrente.
 * `ocorrencias` inclui a primeira. Passo: semanal=7d, quinzenal=14d,
 * mensal = mesmo dia do mês seguinte (com clamp em meses curtos).
 */
export function gerarOcorrencias(
  primeiroInicio: Date,
  duracaoMin: number,
  recorrencia: Recorrencia,
  ocorrencias: number,
): { inicio: Date; fim: Date }[] {
  const total = recorrencia === "nenhuma" ? 1 : Math.max(1, ocorrencias);
  const out: { inicio: Date; fim: Date }[] = [];

  for (let i = 0; i < total; i++) {
    const inicio = new Date(primeiroInicio);
    if (recorrencia === "semanal") inicio.setUTCDate(inicio.getUTCDate() + i * 7);
    else if (recorrencia === "quinzenal")
      inicio.setUTCDate(inicio.getUTCDate() + i * 14);
    else if (recorrencia === "mensal") {
      const alvoMes = primeiroInicio.getUTCMonth() + i;
      inicio.setUTCFullYear(
        primeiroInicio.getUTCFullYear() + Math.floor(alvoMes / 12),
      );
      inicio.setUTCMonth(alvoMes % 12, 1);
      const ultimoDia = new Date(
        Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 0),
      ).getUTCDate();
      inicio.setUTCDate(Math.min(primeiroInicio.getUTCDate(), ultimoDia));
    }
    const fim = new Date(inicio.getTime() + duracaoMin * 60000);
    out.push({ inicio, fim });
  }
  return out;
}

const FMT_HORA = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const FMT_DATA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const FMT_DATA_LONGA = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "long",
  timeZone: "America/Sao_Paulo",
});

const FMT_CHAVE = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/** Data no fuso de Brasília como YYYY-MM-DD — chave para agrupar por dia. */
export function dataChaveBR(iso: string): string {
  return FMT_CHAVE.format(new Date(iso));
}

export function horaBR(iso: string): string {
  return FMT_HORA.format(new Date(iso));
}
export function dataBR(iso: string): string {
  return FMT_DATA.format(new Date(iso));
}
export function dataLongaBR(iso: string): string {
  return FMT_DATA_LONGA.format(new Date(iso));
}
