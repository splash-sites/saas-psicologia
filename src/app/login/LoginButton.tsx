"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GOOGLE_AGENDA_ATIVA } from "@/lib/google/flag";

export function LoginButton() {
  const [carregando, setCarregando] = useState(false);

  async function handleGoogleLogin() {
    setCarregando(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Com a integração ligada, o escopo do Calendar vai já no login para
        // reaproveitar o mesmo consentimento OAuth na Agenda/Meet (item 12/17
        // do MVP). `calendar.events` e não `calendar`: o app só cria/edita
        // eventos, e a verificação do Google exige o menor escopo que resolve.
        // Desligada (ver lib/google/flag.ts): só o login básico, sem verificação.
        ...(GOOGLE_AGENDA_ATIVA && {
          scopes: "https://www.googleapis.com/auth/calendar.events",
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        }),
      },
    });
  }

  return (
    <button
      onClick={handleGoogleLogin}
      disabled={carregando}
      className="btn btn-primary w-full"
    >
      {carregando ? "Redirecionando..." : "Entrar com Google"}
    </button>
  );
}
