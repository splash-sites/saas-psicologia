// Login e conexão da Agenda pelo próprio domínio do app (Google Identity
// Services, "code model" em popup), sem passar pelo redirect do Supabase.
// Motivo: o Google mostra na tela de consentimento o domínio de onde o fluxo
// volta, e a verificação do app exige que seja um domínio nosso — com o
// redirect do Supabase aparecia spdp….supabase.co. Ver CLAUDE.md.
//
// O navegador recebe um código de uso único e o envia para /api/google/*; a
// troca pelo token acontece aqui, com o client secret, que nunca sai do servidor.

// Menor escopo que cobre o app: criar/alterar/apagar eventos (com Meet e
// convidados) nas agendas de que a psicóloga é dona — só a principal é usada.
export const ESCOPO_AGENDA = "https://www.googleapis.com/auth/calendar.events.owned";

/** Cookie do "state" (double-submit): só o próprio app consegue gravá-lo. */
export const COOKIE_STATE = "g_oauth_state";

export type TokensGoogle = {
  idToken: string | null;
  refreshToken: string | null;
  scope: string;
};

/** Troca o código do popup (redirect_uri "postmessage") pelos tokens. */
export async function trocarCodigoGoogle(code: string): Promise<TokensGoogle> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: "postmessage",
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Falha ao trocar o código do Google: ${res.status}`);
  const json = (await res.json()) as {
    id_token?: string;
    refresh_token?: string;
    scope?: string;
  };
  return {
    idToken: json.id_token ?? null,
    refreshToken: json.refresh_token ?? null,
    scope: json.scope ?? "",
  };
}

/**
 * Barra pedido forjado: o código só vale se veio do próprio app (Origin igual
 * ao do servidor) e com o mesmo state que o app gravou em cookie antes de abrir
 * o popup. Sem isso, outro site poderia fazer o navegador da vítima entrar na
 * conta do atacante (login CSRF).
 */
export function pedidoGoogleValido(
  origem: string | null,
  origemEsperada: string,
  stateCorpo: unknown,
  stateCookie: string | undefined,
): boolean {
  return (
    origem === origemEsperada &&
    typeof stateCorpo === "string" &&
    stateCorpo.length >= 16 &&
    stateCorpo === stateCookie
  );
}
