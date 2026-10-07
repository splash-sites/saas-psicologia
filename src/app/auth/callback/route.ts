import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto";
import { destinoSeguro } from "@/lib/auth/redirect";
import {
  escopoTemCalendar,
  integracaoGoogleConfigurada,
  trocarRefreshToken,
} from "@/lib/google/calendar";

type ResultadoToken = "guardado" | "sem_permissao" | "ignorado";

// Guarda o refresh token do Google (quando o login o devolve) para uso
// server-side posterior na Calendar API, criptografado antes de persistir.
// Só sobrescreve se a permissão da Agenda foi de fato concedida: o Google deixa
// a usuária desmarcá-la na tela de consentimento, e um token sem ela quebraria
// a sincronização que já funcionava.
async function guardarRefreshTokenGoogle(
  psicologaId: string,
  refreshToken: string | null | undefined,
): Promise<ResultadoToken> {
  if (!refreshToken || !integracaoGoogleConfigurada()) return "ignorado";
  try {
    const { scope } = await trocarRefreshToken(refreshToken);
    if (!escopoTemCalendar(scope)) return "sem_permissao";

    await createAdminClient()
      .from("google_oauth_tokens")
      .upsert(
        {
          psicologa_id: psicologaId,
          refresh_token_cifrado: encrypt(refreshToken),
          escopo: scope,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "psicologa_id" },
      );
    return "guardado";
  } catch {
    // Não bloqueia o login se a persistência do token falhar.
    return "ignorado";
  }
}

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
