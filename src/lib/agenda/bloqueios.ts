import { addDias, brWallTimeToDate, dataChaveBR, gerarOcorrencias, horaBR } from "./datas";
import type { Recorrencia } from "./types";

/** Sugestões do motivo (texto livre, obrigatório). */
export const SUGESTOES_MOTIVO_BLOQUEIO = ["Férias", "Feriado", "Compromisso pessoal", "Curso", "Saúde"] as const;

/** Recorrência e vários dias: no máximo 1 ano à frente do primeiro dia. */
export const MAX_DIAS_BLOQUEIO = 365;

export type BloqueioEntrada = {
  dia_inteiro: boolean;
  data: string; // AAAA-MM-DD (primeiro dia)
  data_fim?: string; // dia inteiro sem recorrência: último dia (férias)
  hora_inicio?: string;
  hora_fim?: string;
  recorrencia: Recorrencia;
  repetir_ate?: string; // recorrente: último dia possível
};

/** Dias das ocorrências (AAAA-MM-DD), do primeiro até `ate`, inclusive. */
export function datasRecorrentes(data: string, recorrencia: Recorrencia, ate: string): string[] {
  if (recorrencia === "nenhuma") return [data];
  // Meio-dia UTC: o dia não muda com o fuso ao somar semanas/meses.
  const primeiro = new Date(`${data}T12:00:00Z`);
  return gerarOcorrencias(primeiro, 0, recorrencia, 60)
    .map((o) => o.inicio.toISOString().slice(0, 10))
    .filter((d) => d <= ate);
}

/** Intervalos (início/fim) que o bloqueio ocupa, um por ocorrência. */
export function intervalosDoBloqueio(v: BloqueioEntrada): { inicio: Date; fim: Date }[] {
  const datas = datasRecorrentes(v.data, v.recorrencia, v.repetir_ate ?? v.data);
  return datas.map((d) => {
    if (v.dia_inteiro) {
      // Vários dias só sem recorrência (férias); recorrente = um dia por vez.
      const ultimo = v.recorrencia === "nenhuma" ? (v.data_fim ?? d) : d;
      return { inicio: brWallTimeToDate(d, "00:00"), fim: brWallTimeToDate(addDias(ultimo, 1), "00:00") };
    }
    return { inicio: brWallTimeToDate(d, v.hora_inicio!), fim: brWallTimeToDate(d, v.hora_fim!) };
  });
}

/** Dias (AAAA-MM-DD, Brasília) cobertos por um bloqueio de dia inteiro. */
export function diasDoBloqueio(b: { inicio: string; fim: string }): string[] {
  const dias: string[] = [];
  const ultimo = dataChaveBR(new Date(new Date(b.fim).getTime() - 1).toISOString());
  for (let d = dataChaveBR(b.inicio); d <= ultimo && dias.length <= MAX_DIAS_BLOQUEIO + 1; d = addDias(d, 1)) {
    dias.push(d);
  }
  return dias;
}

function dataCurta(d: string): string {
  const [, m, dia] = d.split("-");
  return `${dia}/${m}`;
}

/** "Dia inteiro · 20/12 a 05/01", "Dia inteiro" ou "14:00–18:00". */
export function horarioDoBloqueio(b: { inicio: string; fim: string; dia_inteiro?: boolean }): string {
  if (!b.dia_inteiro) return `${horaBR(b.inicio)}–${horaBR(b.fim)}`;
  const dias = diasDoBloqueio(b);
  return dias.length > 1 ? `Dia inteiro · ${dataCurta(dias[0])} a ${dataCurta(dias[dias.length - 1])}` : "Dia inteiro";
}
