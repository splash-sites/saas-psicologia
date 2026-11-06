// "Lembrar de mim" (tela de login, 2026-11-06).
//
// Marcado (padrão): os cookies da sessão valem 400 dias (o @supabase/ssr força
// esse maxAge em toda gravação, ignorando cookieOptions). Desmarcado: viram
// cookies de sessão do navegador (sem maxAge/expires) e somem ao fechá-lo.
//
// A escolha fica no cookie COOKIE_LEMBRAR = "0" (só existe quando desmarcado),
// lido nos três lugares que gravam a sessão: client do navegador, client do
// servidor (login com Google) e o proxy, que renova o token a cada hora.

export const COOKIE_LEMBRAR = "gradatim_lembrar";

type OpcoesCookie = { maxAge?: number; expires?: Date; [k: string]: unknown };

export function lembrarDoValor(valor: string | undefined | null): boolean {
  return valor !== "0";
}

/** Tira a validade dos cookies da sessão quando a pessoa não quer ser lembrada.
 * Remoção (maxAge 0) passa intacta: apagar o cookie no logout precisa dela. */
export function ajustarValidade<T extends OpcoesCookie>(opcoes: T, lembrar: boolean): T {
  if (lembrar || opcoes.maxAge === 0) return opcoes;
  const semValidade = { ...opcoes };
  delete semValidade.maxAge;
  delete semValidade.expires;
  return semValidade;
}

/** Grava a escolha no navegador antes do login (email ou Google). */
export function salvarEscolhaLembrar(lembrar: boolean): void {
  const seguro = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = lembrar
    ? `${COOKIE_LEMBRAR}=; Path=/; Max-Age=0; SameSite=Lax${seguro}`
    : `${COOKIE_LEMBRAR}=0; Path=/; SameSite=Lax${seguro}`;
}
