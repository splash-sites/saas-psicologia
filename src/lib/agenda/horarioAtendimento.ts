// Horário de atendimento (migration 0044) e horários livres da prévia do
// formulário de consulta. Lógica pura, em minutos no dia (horário de Brasília).

/** 0 = domingo … 6 = sábado (igual a Date.getUTCDay). */
export type HorarioDia = { dia: number; ativo: boolean; inicio: string; fim: string };

export const NOMES_DIA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
/** Ordem da tela: segunda primeiro. */
export const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];

/** Padrão para quem nunca salvou: segunda a sexta, 08:00 às 20:00. */
export const HORARIO_PADRAO: HorarioDia[] = [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
  dia,
  ativo: dia >= 1 && dia <= 5,
  inicio: "08:00",
  fim: "20:00",
}));

/** Passo entre os começos de horário oferecidos. */
export const PASSO_MIN = 30;

export function paraMinutos(hhmm: string): number {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

export function paraHora(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** Linhas do banco (podem faltar dias, hora como "08:00:00") → os 7 dias. */
export function horarioDaConta(
  linhas: { dia_semana: number; ativo: boolean; inicio: string; fim: string }[] | null | undefined,
): HorarioDia[] {
  return HORARIO_PADRAO.map((p) => {
    const l = linhas?.find((x) => x.dia_semana === p.dia);
    return l ? { dia: p.dia, ativo: l.ativo, inicio: l.inicio.slice(0, 5), fim: l.fim.slice(0, 5) } : p;
  });
}

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Lê os 7 dias do formulário de Configurações (`ativo_N`, `inicio_N`, `fim_N`,
 * N = 0…6). Dia ligado precisa de início e fim válidos, com o fim depois do
 * início; dia desligado com horário inválido guarda o padrão (o banco exige
 * fim > início em toda linha).
 */
export function lerHorarioDoFormulario(get: (campo: string) => string | null): {
  horario: HorarioDia[];
  erros: Record<string, string[]>;
} {
  const erros: Record<string, string[]> = {};
  const horario = HORARIO_PADRAO.map((p) => {
    const ativo = get(`ativo_${p.dia}`) === "on";
    const inicio = (get(`inicio_${p.dia}`) ?? "").slice(0, 5);
    const fim = (get(`fim_${p.dia}`) ?? "").slice(0, 5);
    const validos = HORA_RE.test(inicio) && HORA_RE.test(fim);
    const ordem = validos && paraMinutos(fim) > paraMinutos(inicio);
    if (ativo && !validos) erros[`fim_${p.dia}`] = [`Informe início e fim de ${NOMES_DIA[p.dia].toLowerCase()}.`];
    else if (ativo && !ordem) erros[`fim_${p.dia}`] = [`Em ${NOMES_DIA[p.dia].toLowerCase()}, o fim precisa ser depois do início.`];
    return ordem ? { dia: p.dia, ativo, inicio, fim } : { ...p, ativo };
  });
  return { horario, erros };
}

export type Intervalo = { ini: number; fim: number };

/**
 * Começos livres (minutos no dia) para uma consulta de `duracao` minutos:
 * de meia em meia hora dentro do atendimento, a consulta inteira cabe antes
 * do fim, sem cruzar nada de `ocupados` (consultas não canceladas e eventos);
 * `aPartirDe` corta o que já passou hoje.
 */
export function horariosLivres(p: {
  horario: HorarioDia;
  duracao: number;
  ocupados: Intervalo[];
  aPartirDe?: number | null;
}): number[] {
  if (!p.horario.ativo || !(p.duracao > 0)) return [];
  const ini = paraMinutos(p.horario.inicio);
  const fim = paraMinutos(p.horario.fim);
  const livres: number[] = [];
  for (let m = Math.ceil(ini / PASSO_MIN) * PASSO_MIN; m + p.duracao <= fim; m += PASSO_MIN) {
    if (p.aPartirDe != null && m < p.aPartirDe) continue;
    const f = m + p.duracao;
    if (p.ocupados.some((o) => o.ini < f && o.fim > m)) continue;
    livres.push(m);
  }
  return livres;
}

export const PERIODOS = [
  { nome: "Manhã", de: 0, ate: 12 * 60 },
  { nome: "Tarde", de: 12 * 60, ate: 18 * 60 },
  { nome: "Noite", de: 18 * 60, ate: 24 * 60 },
] as const;

/** O que termina antes e o que começa depois de um horário escolhido. */
export function vizinhos<T extends Intervalo>(itens: T[], inicio: number, duracao: number): { antes: T | null; depois: T | null } {
  let antes: T | null = null;
  let depois: T | null = null;
  for (const it of itens) {
    if (it.fim <= inicio && (!antes || it.fim > antes.fim)) antes = it;
    if (it.ini >= inicio + duracao && (!depois || it.ini < depois.ini)) depois = it;
  }
  return { antes, depois };
}
