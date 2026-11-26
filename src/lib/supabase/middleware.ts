import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { rotaPublica } from "./rotas-publicas";
import { ajustarValidade, COOKIE_LEMBRAR, lembrarDoValor } from "./lembrar";

// requestHeaders: headers extras que seguem para a renderização (nonce/CSP do
// proxy). Os cookies renovados da sessão são copiados para eles também.
export async function updateSession(
  request: NextRequest,
  requestHeaders: Headers = new Headers(request.headers),
) {
  const seguir = () => {
    requestHeaders.set("cookie", request.headers.get("cookie") ?? "");
    return NextResponse.next({ request: { headers: requestHeaders } });
  };
  let supabaseResponse = seguir();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = seguir();
          // "Lembrar de mim" desmarcado: o token renovado também vira cookie
          // de sessão do navegador (ver ./lembrar.ts).
          const lembrar = lembrarDoValor(request.cookies.get(COOKIE_LEMBRAR)?.value);
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, ajustarValidade(options, lembrar));
          }
        },
      },
    },
  );

  // getClaims valida o token localmente (JWKS) e renova a sessão quando
  // expira — sem ir ao servidor de Auth a cada requisição (ver
  // src/lib/auth/usuario.ts para o porquê e o trade-off).
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const isPublicPath = rotaPublica(request.nextUrl.pathname);

  if (!user && !isPublicPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  // Já logada: "Entrar" (link da landing) e "Criar conta" levam direto ao
  // Painel. Link de cupom (/cadastro?cupom=X) vai para a Assinatura, onde o
  // código pode ser usado por quem já tem conta.
  const caminho = request.nextUrl.pathname;
  if (user && (caminho === "/login" || caminho === "/cadastro")) {
    const destino = request.nextUrl.clone();
    const cupom = caminho === "/cadastro" ? request.nextUrl.searchParams.get("cupom") : null;
    destino.pathname = cupom ? "/assinatura" : "/dashboard";
    destino.search = cupom ? `?cupom=${encodeURIComponent(cupom)}` : "";
    const resposta = NextResponse.redirect(destino);
    // Leva junto o token renovado agora (senão o próximo pedido renova de novo).
    for (const c of supabaseResponse.cookies.getAll()) resposta.cookies.set(c);
    return resposta;
  }

  return supabaseResponse;
}
