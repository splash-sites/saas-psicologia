// Feriados nacionais e estaduais, calculados no código (entrega E, decidido em
// 2026-11-23): sem API (a BrasilAPI só tem os nacionais) e sem municipais.
// Móveis pela Páscoa (computus). Fonte da lista estadual: tabelas por UF de
// "Feriados no Brasil" (Wikipédia, conferida em 2026-11-24), com as leis citadas
// lá. Só feriados de lei; pontos facultativos estaduais por decreto anual ficam
// de fora. Lei nova ou estado que muda feriado = atualizar aqui (e os testes).

export type Feriado = {
  data: string; // AAAA-MM-DD
  nome: string;
  /** Ponto facultativo (Carnaval, Cinzas, Corpus Christi): cor mais leve. */
  facultativo: boolean;
};

export const UFS = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão",
  MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará",
  PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima",
  SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
} as const;
export type UF = keyof typeof UFS;

export function ufValida(v: unknown): v is UF {
  return typeof v === "string" && Object.hasOwn(UFS, v);
}

const DIA = 86_400_000;
const utc = (ano: number, mes: number, dia: number) => new Date(Date.UTC(ano, mes - 1, dia));
const iso = (d: Date) => d.toISOString().slice(0, 10);
const somar = (d: Date, dias: number) => new Date(d.getTime() + dias * DIA);

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function pascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(utc(ano, mes, dia));
}

type Regra =
  | { dia: number; mes: number; nome: string; desde?: number }
  | { pascoa: number; nome: string; facultativo?: boolean };

const NACIONAIS: Regra[] = [
  { dia: 1, mes: 1, nome: "Confraternização Universal" },
  { pascoa: -48, nome: "Carnaval", facultativo: true },
  { pascoa: -47, nome: "Carnaval", facultativo: true },
  { pascoa: -46, nome: "Quarta-feira de Cinzas", facultativo: true },
  { pascoa: -2, nome: "Sexta-feira Santa" },
  { dia: 21, mes: 4, nome: "Tiradentes" },
  { dia: 1, mes: 5, nome: "Dia do Trabalho" },
  { pascoa: 60, nome: "Corpus Christi", facultativo: true },
  { dia: 7, mes: 9, nome: "Independência do Brasil" },
  { dia: 12, mes: 10, nome: "Nossa Senhora Aparecida" },
  { dia: 2, mes: 11, nome: "Finados" },
  { dia: 15, mes: 11, nome: "Proclamação da República" },
  // Lei 14.759/2023: nacional a partir de 2024.
  { dia: 20, mes: 11, nome: "Consciência Negra", desde: 2024 },
  { dia: 25, mes: 12, nome: "Natal" },
];

const ESTADUAIS: Partial<Record<UF, Regra[]>> = {
  AC: [
    { dia: 22, mes: 1, nome: "Dia do Católico" },
    { dia: 23, mes: 1, nome: "Dia do Evangélico" },
    { dia: 8, mes: 3, nome: "Dia Internacional da Mulher" },
    { dia: 15, mes: 6, nome: "Aniversário do Acre" },
    { dia: 5, mes: 9, nome: "Dia da Amazônia" },
    { dia: 17, mes: 11, nome: "Tratado de Petrópolis" },
  ],
  AL: [
    { dia: 24, mes: 6, nome: "São João" },
    { dia: 29, mes: 6, nome: "São Pedro" },
    { dia: 16, mes: 9, nome: "Emancipação Política de Alagoas" },
    { dia: 30, mes: 11, nome: "Dia do Evangélico" },
  ],
  AP: [
    { dia: 19, mes: 3, nome: "São José" },
    { dia: 15, mes: 5, nome: "Dia de Cabralzinho" },
    { dia: 13, mes: 9, nome: "Criação do Território do Amapá" },
  ],
  AM: [
    { dia: 5, mes: 9, nome: "Elevação do Amazonas à Província" },
    { dia: 8, mes: 12, nome: "Nossa Senhora da Conceição" },
  ],
  BA: [
    { dia: 24, mes: 6, nome: "São João" },
    { dia: 2, mes: 7, nome: "Independência da Bahia" },
  ],
  CE: [
    { dia: 19, mes: 3, nome: "São José" },
    { dia: 25, mes: 3, nome: "Data Magna do Ceará" },
  ],
  DF: [
    { dia: 21, mes: 4, nome: "Fundação de Brasília" },
    { dia: 30, mes: 11, nome: "Dia do Evangélico" },
  ],
  // Segunda-feira, oito dias depois do domingo de Páscoa.
  ES: [{ pascoa: 8, nome: "Nossa Senhora da Penha" }],
  MA: [{ dia: 28, mes: 7, nome: "Adesão do Maranhão à Independência" }],
  MS: [{ dia: 11, mes: 10, nome: "Criação do Estado" }],
  PA: [{ dia: 15, mes: 8, nome: "Adesão do Pará à Independência" }],
  PB: [{ dia: 5, mes: 8, nome: "Fundação do Estado" }],
  PE: [{ dia: 6, mes: 3, nome: "Revolução Pernambucana" }],
  PI: [{ dia: 19, mes: 10, nome: "Dia do Piauí" }],
  // No RJ, a terça de Carnaval e Corpus Christi são feriados estaduais (Lei 5.243/2008).
  RJ: [
    { pascoa: -47, nome: "Carnaval" },
    { dia: 23, mes: 4, nome: "São Jorge" },
    { pascoa: 60, nome: "Corpus Christi" },
  ],
  RN: [{ dia: 3, mes: 10, nome: "Mártires de Cunhaú e Uruaçu" }],
  RO: [
    { dia: 4, mes: 1, nome: "Criação do Estado" },
    { dia: 18, mes: 6, nome: "Dia do Evangélico" },
  ],
  RR: [{ dia: 5, mes: 10, nome: "Criação do Estado" }],
  RS: [{ dia: 20, mes: 9, nome: "Revolução Farroupilha" }],
  SC: [
    { dia: 11, mes: 8, nome: "Data Magna de Santa Catarina" },
    { dia: 25, mes: 11, nome: "Santa Catarina de Alexandria" },
  ],
  SE: [{ dia: 8, mes: 7, nome: "Emancipação Política de Sergipe" }],
  SP: [{ dia: 9, mes: 7, nome: "Revolução Constitucionalista" }],
  TO: [
    { dia: 8, mes: 9, nome: "Nossa Senhora da Natividade" },
    { dia: 5, mes: 10, nome: "Criação do Estado" },
  ],
};

function dataDaRegra(r: Regra, ano: number, domingoPascoa: Date): Date | null {
  if ("pascoa" in r) return somar(domingoPascoa, r.pascoa);
  if (r.desde && ano < r.desde) return null;
  return utc(ano, r.mes, r.dia);
}

/** Regras de transferência por lei estadual. */
function transferir(uf: UF, d: Date, nome: string): Date {
  const semana = d.getUTCDay(); // 0 = domingo
  // Acre (Lei 2.247/2009): de terça a quinta vai para a sexta, menos o aniversário do estado.
  if (uf === "AC" && nome !== "Aniversário do Acre" && semana >= 2 && semana <= 4) return somar(d, 5 - semana);
  // Santa Catarina (Lei 12.906/2004): em dia de semana, vai para o domingo seguinte.
  if (uf === "SC" && semana !== 0) return somar(d, 7 - semana);
  return d;
}

const cache = new Map<string, Map<string, Feriado>>();

/** Feriados do ano (nacionais + do estado), um por dia: feriado vence ponto facultativo. */
export function feriadosDoAno(ano: number, uf?: UF | null): Map<string, Feriado> {
  const chave = `${ano}-${uf ?? ""}`;
  const pronto = cache.get(chave);
  if (pronto) return pronto;

  const [pa, pm, pd] = pascoa(ano).split("-").map(Number);
  const domingo = utc(pa, pm, pd);
  const porDia = new Map<string, Feriado>();
  const incluir = (d: Date | null, nome: string, facultativo: boolean) => {
    if (!d) return;
    const data = iso(d);
    const atual = porDia.get(data);
    // O primeiro vale (nacional antes do estadual); feriado substitui ponto facultativo.
    if (!atual || (atual.facultativo && !facultativo)) porDia.set(data, { data, nome, facultativo });
  };
  for (const r of NACIONAIS) incluir(dataDaRegra(r, ano, domingo), r.nome, "pascoa" in r && Boolean(r.facultativo));
  for (const r of (uf && ESTADUAIS[uf]) || []) {
    const d = dataDaRegra(r, ano, domingo);
    incluir(d && uf ? transferir(uf, d, r.nome) : d, r.nome, false);
  }
  const ordenado = new Map([...porDia.entries()].sort(([a], [b]) => a.localeCompare(b)));
  cache.set(chave, ordenado);
  return ordenado;
}

/** Feriado (ou ponto facultativo) do dia AAAA-MM-DD, se houver. */
export function feriadoDoDia(data: string, uf?: UF | null): Feriado | null {
  return feriadosDoAno(Number(data.slice(0, 4)), uf).get(data) ?? null;
}

/** "Feriado: Natal" ou "Ponto facultativo: Carnaval". */
export function rotuloFeriado(f: Feriado): string {
  return `${f.facultativo ? "Ponto facultativo" : "Feriado"}: ${f.nome}`;
}

/** Preferência gravada em psicologas (0038). */
export type PreferenciaFeriados = { feriados_uf?: string | null; mostrar_feriados?: boolean | null } | null | undefined;

/** Estado dos feriados estaduais, ou null (só nacionais). */
export function ufDaPreferencia(p: PreferenciaFeriados): UF | null {
  return ufValida(p?.feriados_uf) ? p.feriados_uf : null;
}

/** Feriados dos dias pedidos, respeitando "Mostrar feriados no calendário". */
export function feriadosDaPsicologa(dias: string[], p: PreferenciaFeriados): Map<string, Feriado> {
  const r = new Map<string, Feriado>();
  if (p?.mostrar_feriados === false) return r;
  const uf = ufDaPreferencia(p);
  for (const d of dias) {
    const f = feriadoDoDia(d, uf);
    if (f) r.set(d, f);
  }
  return r;
}

/** Feriados em que caem as sessões de uma consulta (ou série) que está sendo marcada. */
export function feriadosDasSessoes(datas: string[], p: PreferenciaFeriados): Feriado[] {
  return [...feriadosDaPsicologa([...new Set(datas)], p).values()];
}

/** Aviso ao marcar: só informa, deixa marcar. `total` = sessões da série. */
export function avisoFeriados(caem: Feriado[], total: number): string | null {
  if (caem.length === 0) return null;
  const dm = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;
  const item = (f: Feriado) => `${dm(f.data)} ${f.nome}${f.facultativo ? " (ponto facultativo)" : ""}`;
  if (total <= 1) {
    const f = caem[0];
    return `${f.facultativo ? "Esse dia é ponto facultativo" : "Esse dia é feriado"}: ${f.nome}. Dá para marcar mesmo assim.`;
  }
  const n = caem.length;
  return `${n} das ${total} sessões ${n === 1 ? "cai" : "caem"} em feriado: ${caem.map(item).join(", ")}. Dá para marcar mesmo assim.`;
}
