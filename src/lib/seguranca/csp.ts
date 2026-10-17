// Content-Security-Policy do app (aplicada pelo proxy, com nonce novo a cada
// requisição — guia "content-security-policy" do Next).
//
// - script-src: só scripts com o nonce desta resposta ('strict-dynamic' deixa
//   os chunks carregados por eles rodarem). Um HTML injetado (ex: nome de
//   paciente malicioso) não consegue executar script.
// - style-src 'unsafe-inline': a agenda posiciona eventos com style={...} e o
//   prontuário impresso usa <style>; CSS injetado é risco bem menor que script.
// - connect-src: só o próprio app e o Supabase (login por e-mail roda no
//   navegador). Dado não pode ser enviado pra outro domínio via fetch.
// - frame-ancestors 'none': ninguém embute o painel num iframe (clickjacking).
// - accounts.google.com/gsi: login com Google pelo próprio domínio (Google
//   Identity Services, ver lib/google/oauth.ts). O script entra pelo
//   'strict-dynamic' (é criado pelo nosso código); estilo, iframe e chamadas
//   do GIS ficam restritos ao caminho /gsi.

const GOOGLE = "https://accounts.google.com";

export function gerarNonce(): string {
  return btoa(crypto.randomUUID());
}

export function montarCsp(
  nonce: string,
  { dev, supabaseUrl }: { dev: boolean; supabaseUrl?: string },
): string {
  const supabase = supabaseUrl ? new URL(supabaseUrl).origin : "";
  const diretivas = [
    "default-src 'self'",
    // 'unsafe-eval' só em dev: o React usa eval para reconstruir stack traces.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline' ${GOOGLE}/gsi/style`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // ws: em dev para o hot reload.
    `connect-src 'self'${supabase ? ` ${supabase}` : ""} ${GOOGLE}/gsi/${dev ? " ws:" : ""}`,
    `frame-src ${GOOGLE}/gsi/`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ];
  return diretivas.join("; ");
}
