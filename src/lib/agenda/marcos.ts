// Instantes em que uma tela que depende do horário muda de estado e precisa
// ser buscada de novo no servidor (ver src/components/AutoRefresh.tsx).
// Puro: usado pelo servidor (calcula os marcos) e pelo navegador (agenda).

import { ANTECEDENCIA_MEET_MIN } from "./estado";
import { addDias, intervaloDiaBR } from "./datas";

/** "Começa em N min" aparece a partir de 60 min antes. */
const AVISO_INICIO_MIN = 60;
/** Folga depois do marco, para o servidor já ver o estado novo. */
const FOLGA_MS = 1_000;

type ConsultaMarco = { inicio: string; fim: string; status: string };

/**
 * Marcos de hoje: para cada sessão ativa, 60 min antes (aviso), 10 min antes
 * (Meet em destaque), início (em andamento) e fim (encerrada / evolução
 * pendente). Mais a meia-noite, quando "hoje" vira outro dia.
 */
export function marcosDoDia(consultas: ConsultaMarco[], hoje: string): string[] {
  const marcos = new Set<string>([intervaloDiaBR(addDias(hoje, 1)).inicio]);
  const { inicio: ini, fim } = intervaloDiaBR(hoje);
  for (const c of consultas) {
    if (c.status === "cancelada" || c.status === "falta") continue;
    if (c.inicio >= fim || c.fim < ini) continue;
    const t = new Date(c.inicio).getTime();
    marcos.add(new Date(t - AVISO_INICIO_MIN * 60_000).toISOString());
    marcos.add(new Date(t - ANTECEDENCIA_MEET_MIN * 60_000).toISOString());
    marcos.add(new Date(t).toISOString());
    marcos.add(new Date(c.fim).toISOString());
  }
  return [...marcos].sort();
}

/**
 * Quantos ms esperar até a próxima recarga (0 = recarregar já).
 * Já: um marco passou desde a última recarga (ex.: aba estava escondida) ou o
 * intervalo de segurança venceu. Senão, o que vier antes: próximo marco (+folga)
 * ou fim do intervalo.
 */
export function proximaRecarga(
  marcos: string[],
  agora: number,
  ultima: number,
  intervaloMin: number,
): number {
  const intervalo = intervaloMin * 60_000;
  const tempos = marcos.map((m) => new Date(m).getTime()).filter((t) => !Number.isNaN(t));
  if (tempos.some((t) => t > ultima && t + FOLGA_MS <= agora)) return 0;
  if (agora - ultima >= intervalo) return 0;
  const proximo = tempos.filter((t) => t + FOLGA_MS > agora).sort((a, b) => a - b)[0];
  const ateIntervalo = ultima + intervalo - agora;
  return proximo === undefined
    ? ateIntervalo
    : Math.min(proximo + FOLGA_MS - agora, ateIntervalo);
}
