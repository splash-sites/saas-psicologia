import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { encrypt, cryptoDisponivel } from "@/lib/crypto";

// Guarda o refresh token do Google (quando o login o devolve) para uso
// server-side posterior na Calendar API. Criptografado antes de persistir.
async function guardarRefreshTokenGoogle(
  psicologaId: string,
  refreshToken: string | null | undefined,
  escopo: string | null | undefined,
) {
  if (!refreshToken) return;
  if (!cryptoDisponivel() || !adminDisponivel()) return;
  try {
    const admin = createAdminClient();
    await admin.from("google_oauth_tokens").upsert(
      {
        psicologa_id: psicologaId,
        refresh_token_cifrado: encrypt(refreshToken),
        escopo: escopo ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "psicologa_id" },
    );
  } catch {
    // Não bloqueia o login se a persistência do token falhar.
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      await guardarRefreshTokenGoogle(
        data.session.user.id,
        data.session.provider_refresh_token,
        (data.session.user.user_metadata?.scope as string | undefined) ?? null,
      );
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
