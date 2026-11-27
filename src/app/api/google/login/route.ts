import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { COOKIE_STATE } from "@/lib/google/compartilhado";
import { pedidoGoogleValido } from "@/lib/google/oauth";
import { createAdminClient } from "@/lib/supabase/admin";
import { FORMATO_CUPOM, normalizarCupom } from "@/lib/assinatura/cupom";

// "Entrar com Google" (rota pública). Recebe o ID token do botão do Google
// (Sign In With Google, ver app/login/LoginButton.tsx) e abre a sessão no
// Supabase com ele. O Supabase confere assinatura, emissor, audiência
// (client id), validade e o nonce (hash SHA-256 gravado no token). Só
// identidade: a Agenda vem por /api/google/conectar.
export async function POST(request: Request) {
  const corpo = (await request.json().catch(() => ({}))) as {
    credential?: unknown;
    nonce?: unknown;
    cupom?: unknown;
  };
  const cookieStore = await cookies();
  const valido = pedidoGoogleValido(
    request.headers.get("origin"),
    new URL(request.url).origin,
    corpo.nonce,
    cookieStore.get(COOKIE_STATE)?.value,
  );
  cookieStore.delete({ name: COOKIE_STATE, path: "/api/google" });
  if (!valido || typeof corpo.credential !== "string" || corpo.credential.length > 4096) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: corpo.credential,
    nonce: corpo.nonce as string,
  });
  if (error || !data.user) return NextResponse.json({ ok: false }, { status: 401 });

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
