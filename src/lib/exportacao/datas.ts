// Datas por extenso para documentos exportados (CSV e prontuário impresso),
// sempre no horário de Brasília e com o ano — ao contrário dos formatos curtos
// da agenda.

/** "2026-03-09" -> "09/03/2026". Nulo/vazio -> null. */
export function dataBRCompleta(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Timestamp -> "09/03/2026 10:00" em Brasília. Nulo/vazio -> null. */
export function dataHoraBR(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? "";
  return `${p("day")}/${p("month")}/${p("year")} ${p("hour")}:${p("minute")}`;
}
