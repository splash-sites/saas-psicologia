"use client";

import { createClient } from "@/lib/supabase/client";

export function ConectarGoogleButton({ label }: { label: string }) {
  async function conectar() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/configuracoes`,
        scopes: "https://www.googleapis.com/auth/calendar",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  }

  return (
    <button
      onClick={conectar}
      className="w-fit rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-black/80"
    >
      {label}
    </button>
  );
}
