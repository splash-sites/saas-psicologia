"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  async function handleGoogleLogin() {
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
    <main className="flex min-h-screen items-center justify-center">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-lg border p-8">
        <h1 className="text-xl font-semibold">Entrar</h1>
        <button
          onClick={handleGoogleLogin}
          className="rounded-md bg-black px-4 py-2 text-white hover:bg-black/80"
        >
          Entrar com Google
        </button>
      </div>
    </main>
  );
}
