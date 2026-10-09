// Rotas acessíveis sem sessão. O webhook do Asaas entra aqui porque chega sem
// cookie — ele se autentica pelo próprio token (asaas-access-token).
const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/privacidade",
  "/termos",
  "/api/asaas/webhook",
];

/** Casa o caminho exato ou um subcaminho dele (nunca "/loginx"). */
export function rotaPublica(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
