import { dataChaveBR } from "@/lib/agenda/datas";

/** Mês corrente (YYYY-MM) no fuso de Brasília. */
export function mesAtual(): string {
  return dataChaveBR(new Date().toISOString()).slice(0, 7);
}

export function primeiroDia(mes: string): string {
  return `${mes}-01`;
}

export function ultimoDia(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  const dia = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  return `${mes}-${String(dia).padStart(2, "0")}`;
}

export function mesSeguinte(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(ano, m, 1)); // m já é 1-indexed => próximo mês
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function mesAnterior(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(ano, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const FMT_MES = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function rotuloMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  return FMT_MES.format(new Date(Date.UTC(ano, m - 1, 1)));
}

/** Os N meses (YYYY-MM) terminando em `mes`, do mais antigo ao mais recente. */
export function ultimosMeses(mes: string, n: number): string[] {
  const out: string[] = [mes];
  for (let i = 1; i < n; i++) out.unshift(mesAnterior(out[0]));
  return out;
}
