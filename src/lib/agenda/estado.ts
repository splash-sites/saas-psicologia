// Em que momento está uma sessão em relação a "agora". Usado no painel para
// decidir o que destacar: entrar no Meet perto do horário, registrar a
// evolução depois que acabou.

/** Quantos minutos antes do início o Meet passa a ser a ação principal. */
export const ANTECEDENCIA_MEET_MIN = 10;

export type EstadoSessao =
  | "futura" // ainda longe
  | "proxima" // dentro da janela de entrada (ANTECEDENCIA_MEET_MIN antes)
  | "em_andamento"
  | "encerrada";

export function estadoSessao(
  inicioISO: string,
  fimISO: string,
  agora: Date,
): EstadoSessao {
  const inicio = new Date(inicioISO).getTime();
  const fim = new Date(fimISO).getTime();
  const n = agora.getTime();

  if (n >= fim) return "encerrada";
  if (n >= inicio) return "em_andamento";
  if (n >= inicio - ANTECEDENCIA_MEET_MIN * 60_000) return "proxima";
  return "futura";
}

/** O Meet deve aparecer como botão principal? */
export function meetEmDestaque(estado: EstadoSessao): boolean {
  return estado === "proxima" || estado === "em_andamento";
}

/** Minutos (arredondados para cima) até o início; 0 se já começou. */
export function minutosAteInicio(inicioISO: string, agora: Date): number {
  const diff = new Date(inicioISO).getTime() - agora.getTime();
  return diff <= 0 ? 0 : Math.ceil(diff / 60_000);
}

/** Janela (em dias) em que uma sessão sem evolução aparece como pendência. */
export const DIAS_PENDENCIA = 14;

/**
 * Sessões cuja evolução ainda não foi registrada. `idsComEvolucao` são os ids
 * de consulta que já têm uma evolução ativa vinculada.
 */
export function consultasSemEvolucao<T extends { id: string }>(
  consultas: T[],
  idsComEvolucao: Set<string>,
): T[] {
  return consultas.filter((c) => !idsComEvolucao.has(c.id));
}
