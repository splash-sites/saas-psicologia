// Rotas acessíveis sem sessão. O webhook do Asaas entra aqui porque chega sem
// cookie — ele se autentica pelo próprio token (asaas-access-token).
const PUBLIC_PATHS = [
  "/login",
  "/cadastro",
  "/auth/callback",
  // Links dos e-mails (confirmação e recuperação) e o pedido de nova senha.
  "/auth/confirm",
  "/esqueci-senha",
  "/privacidade",
  "/termos",
  "/api/asaas/webhook",
  // Login com Google: chega sem sessão (é ele que cria a sessão).
  "/api/google/login",
];

/** Casa o caminho exato ou um subcaminho dele (nunca "/loginx"). */
export function rotaPublica(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
