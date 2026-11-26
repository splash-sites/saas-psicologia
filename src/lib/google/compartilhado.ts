// Constantes do login/conexão com o Google que o navegador também usa. Ficam
// aqui porque oauth.ts é só do servidor (tem o client secret).

// Menor escopo que cobre o app: criar/alterar/apagar eventos (com Meet e
// convidados) nas agendas de que a psicóloga é dona — só a principal é usada.
export const ESCOPO_AGENDA = "https://www.googleapis.com/auth/calendar.events.owned";

/** Cookie do "state" (double-submit): só o próprio app consegue gravá-lo. */
export const COOKIE_STATE = "g_oauth_state";
