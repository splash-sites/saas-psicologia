// Regra de senha (LGPD, art. 46: conta que guarda prontuário). O mesmo número
// precisa estar no Supabase: config.toml (local) e, em produção, no painel
// (Authentication → Policies → minimum password length).
export const SENHA_MINIMA = 8;

// Quem já tinha senha mais curta continua entrando: o login do Supabase avisa
// (`weakPassword`) e o Painel sugere trocar, sem bloquear. A marca fica só
// neste navegador e volta a cada login enquanto a senha não mudar.
const CHAVE = "gradatim_senha_fraca";
const EVENTO = "gradatim:senha-fraca";

export function marcarSenhaFraca(fraca: boolean): void {
  try {
    if (fraca) localStorage.setItem(CHAVE, "1");
    else localStorage.removeItem(CHAVE);
    window.dispatchEvent(new Event(EVENTO));
  } catch {
    // navegador sem armazenamento: só não mostra o aviso
  }
}

export function senhaFracaMarcada(): boolean {
  try {
    return localStorage.getItem(CHAVE) === "1";
  } catch {
    return false;
  }
}

export function aoMudarSenhaFraca(callback: () => void): () => void {
  window.addEventListener(EVENTO, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENTO, callback);
    window.removeEventListener("storage", callback);
  };
}
