/** Dois intervalos [aInicio, aFim) e [bInicio, bFim) se sobrepõem? */
export function sobrepoe(
  aInicio: Date | string,
  aFim: Date | string,
  bInicio: Date | string,
  bFim: Date | string,
): boolean {
  const ai = new Date(aInicio).getTime();
  const af = new Date(aFim).getTime();
  const bi = new Date(bInicio).getTime();
  const bf = new Date(bFim).getTime();
  return ai < bf && af > bi;
}
