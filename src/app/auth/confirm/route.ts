import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { destinoSeguro } from "@/lib/auth/redirect";

// Links dos e-mails do Supabase Auth (modelos em supabase/templates/):
// confirmação de cadastro e recuperação de senha. Usa token_hash + verifyOtp
// em vez do código PKCE do /auth/callback: o PKCE só funciona no mesmo
// navegador que pediu o e-mail, e a pessoa costuma abrir no celular.
const TIPOS: EmailOtpType[] = ["email", "signup", "recovery"];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;
  const next = destinoSeguro(searchParams.get("next"));

  if (tokenHash && tipo && TIPOS.includes(tipo)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  // Link expirado, já usado ou adulterado.
  return NextResponse.redirect(`${origin}/login?error=link`);
}
