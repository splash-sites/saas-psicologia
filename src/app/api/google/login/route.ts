import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { COOKIE_STATE, pedidoGoogleValido, trocarCodigoGoogle } from "@/lib/google/oauth";
import { guardarRefreshTokenGoogle } from "@/lib/google/tokens";
import { escopoTemCalendar } from "@/lib/google/calendar";
import { createAdminClient } from "@/lib/supabase/admin";
import { FORMATO_CUPOM, normalizarCupom } from "@/lib/assinatura/cupom";

// "Entrar com Google" (rota pública). Recebe o código do popup do Google,
// troca pelos tokens e abre a sessão no Supabase com o id_token. O login pede
// só identidade (dois passos — a Agenda vem por /api/google/conectar); se um
// dia a permissão da Agenda vier junto, o refresh token ainda é guardado.
export async function POST(request: Request) {
  const corpo = (await request.json().catch(() => ({}))) as {
    code?: unknown;
    state?: unknown;
    cupom?: unknown;
  };
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

  // Login em dois passos: o normal é vir sem a Agenda (o painel oferece
  // conectar). Só guarda o token se a Agenda veio junto; nunca trata a
  // ausência dela como erro aqui.
  if (escopoTemCalendar(tokens.scope)) {
    await guardarRefreshTokenGoogle(data.user.id, tokens.refreshToken);
  }

  // Cupom do cadastro (link ?cupom= ou digitado). Mesma regra do banco que a
  // tela de Assinatura (resgatar_cupom, com a sessão que acabou de abrir); o
  // resultado vira o aviso que o Painel mostra uma vez. Nunca impede o login.
  if (typeof corpo.cupom === "string" && corpo.cupom.trim()) {
    const codigo = normalizarCupom(corpo.cupom).slice(0, 30);
    try {
      const { data: status } = FORMATO_CUPOM.test(codigo)
        ? await supabase.rpc("resgatar_cupom", { p_codigo: codigo })
        : { data: "invalido" };
      await createAdminClient()
        .from("cupom_avisos")
        .upsert({ psicologa_id: data.user.id, codigo, status: String(status ?? "invalido"), lido_em: null });
    } catch {
      // Sem aviso: a conta segue com o teste normal.
    }
  }
  return NextResponse.json({ ok: true, destino: "/dashboard" });
}
