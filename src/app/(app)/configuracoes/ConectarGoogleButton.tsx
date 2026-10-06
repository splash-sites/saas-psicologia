"use client";

import { createClient } from "@/lib/supabase/client";

// `vincular`: quando a conta logada ainda não tem NENHUMA identidade Google
// (ex: criou conta por e-mail/senha ou por um provedor diferente), usamos
// linkIdentity() — anexa o Google à conta atual sem trocar de sessão. Sem
// isso, signInWithOAuth() faria um login OAuth normal: se o Gmail escolhido
// nunca foi usado aqui, o Supabase troca a sessão pra uma conta NOVA ligada
// a esse Gmail, em vez de anexar a Agenda à conta que já estava logada.
//
// Quando a conta já tem uma identidade Google (o caso mais comum — logou com
// Google desde o início), continuamos com signInWithOAuth: é só um
// re-consentimento da mesma identidade já vinculada, igual sempre foi.
export function ConectarGoogleButton({
  label,
  vincular = false,
}: {
  label: string;
  vincular?: boolean;
}) {
  async function conectar() {
    const supabase = createClient();
    const credenciais = {
      provider: "google" as const,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/configuracoes`,
        scopes: "https://www.googleapis.com/auth/calendar",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    };
    if (vincular) {
      await supabase.auth.linkIdentity(credenciais);
    } else {
      await supabase.auth.signInWithOAuth(credenciais);
    }
  }

  return (
    <button onClick={conectar} className="w-fit btn btn-primary">
      {label}
    </button>
  );
}
