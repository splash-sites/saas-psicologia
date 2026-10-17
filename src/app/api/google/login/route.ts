import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { COOKIE_STATE, pedidoGoogleValido, trocarCodigoGoogle } from "@/lib/google/oauth";
import { guardarRefreshTokenGoogle } from "@/lib/google/tokens";

// "Entrar com Google" (rota pública). Recebe o código do popup do Google,
// troca pelos tokens, abre a sessão no Supabase com o id_token e, se a
// permissão da Agenda veio junto, guarda o refresh token — login e Agenda num
// passo só, como antes da troca de fluxo.
export async function POST(request: Request) {
  const corpo = (await request.json().catch(() => ({}))) as { code?: unknown; state?: unknown };
  const cookieStore = await cookies();
  const valido = pedidoGoogleValido(
    request.headers.get("origin"),
    new URL(request.url).origin,
    corpo.state,
    cookieStore.get(COOKIE_STATE)?.value,
  );
  cookieStore.delete({ name: COOKIE_STATE, path: "/api/google" });
  if (!valido || typeof corpo.code !== "string") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let tokens;
  try {
    tokens = await trocarCodigoGoogle(corpo.code);
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
  if (!tokens.idToken) return NextResponse.json({ ok: false }, { status: 502 });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: tokens.idToken,
  });
  if (error || !data.user) return NextResponse.json({ ok: false }, { status: 401 });

  const agenda = await guardarRefreshTokenGoogle(data.user.id, tokens.refreshToken);
  // Entrou, mas desmarcou a Agenda na tela do Google: avisa em Configurações.
  const destino = agenda === "sem_permissao" ? "/configuracoes?google=sem-permissao" : "/dashboard";
  return NextResponse.json({ ok: true, destino });
}
