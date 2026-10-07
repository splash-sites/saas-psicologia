import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { gerarNonce, montarCsp } from "@/lib/seguranca/csp";

export async function proxy(request: NextRequest) {
  // CSP com nonce por requisição: o Next lê o nonce do header da requisição e
  // aplica nos próprios scripts; o layout raiz lê x-nonce para o script inline.
  const nonce = gerarNonce();
  const csp = montarCsp(nonce, {
    dev: process.env.NODE_ENV === "development",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = await updateSession(request, requestHeaders);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
