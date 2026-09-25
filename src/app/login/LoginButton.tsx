"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginButton() {
  const [carregando, setCarregando] = useState(false);

  async function handleGoogleLogin() {
    setCarregando(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Escopo do Calendar solicitado já no login para reaproveitar
        // o mesmo consentimento OAuth na integração de Agenda/Meet (item 12/17 do MVP).
        scopes: "https://www.googleapis.com/auth/calendar",
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
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
