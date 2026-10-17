import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { destinoSeguro } from "@/lib/auth/redirect";
import { guardarRefreshTokenGoogle } from "@/lib/google/tokens";

// Fluxo antigo (signInWithOAuth/linkIdentity pelo Supabase) — o login com
// Google agora passa por /api/google/login. Esta rota segue atendendo o link
// de confirmação de e-mail (exchangeCodeForSession) e, se algum provedor
// devolver token do Google por aqui, ainda o guarda.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = destinoSeguro(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      const resultado = await guardarRefreshTokenGoogle(
        data.session.user.id,
        data.session.provider_refresh_token,
      );
      if (resultado === "sem_permissao") {
        return NextResponse.redirect(
          `${origin}/configuracoes?google=sem-permissao`,
        );
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Falhou — negou consentimento, código inválido, ou (ao vincular uma conta
  // Google que já pertence a outra conta nossa) "Identity is already linked
  // to another user". Se veio de Configurações (conectar/vincular Google),
  // volta pra lá com aviso em vez de jogar pro /login: a sessão atual (se o
  // login não foi por Google) continua válida, não faz sentido deslogar.
  if (next === "/configuracoes") {
    return NextResponse.redirect(`${origin}/configuracoes?google=erro`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
