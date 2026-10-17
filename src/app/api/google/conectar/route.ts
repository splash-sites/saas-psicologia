import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { usuarioAtual } from "@/lib/auth/usuario";
import { COOKIE_STATE, pedidoGoogleValido, trocarCodigoGoogle } from "@/lib/google/oauth";
import { guardarRefreshTokenGoogle } from "@/lib/google/tokens";

// "Conectar Google Agenda" em Configurações (exige sessão). Serve para quem
// entrou por e-mail/senha e para reconectar. O token fica ligado à conta
// logada; não troca a sessão nem vincula identidade — a conta Google aqui é só
// a dona da agenda onde os eventos serão criados.
export async function POST(request: Request) {
  const user = await usuarioAtual();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

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

  let refreshToken: string | null;
  try {
    ({ refreshToken } = await trocarCodigoGoogle(corpo.code));
  } catch {
    return NextResponse.json({ ok: false, resultado: "erro" }, { status: 502 });
  }

  const resultado = await guardarRefreshTokenGoogle(user.id, refreshToken);
  return NextResponse.json({ ok: resultado === "guardado", resultado });
}
