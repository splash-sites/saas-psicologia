"use client";

import { useState } from "react";
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
  const [erro, setErro] = useState<string | null>(null);

  async function conectar() {
    setErro(null);
    const supabase = createClient();
    const credenciais = {
      provider: "google" as const,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/configuracoes`,
        scopes: "https://www.googleapis.com/auth/calendar",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    };
    // linkIdentity()/signInWithOAuth() só redirecionam pro Google quando dão
    // certo — se falharem antes disso (ex: "Manual linking is disabled" no
    // projeto Supabase), devolvem o erro aqui em vez de redirecionar, e sem
    // checar isso o clique no botão não fazia nada visível.
    const { error } = vincular
      ? await supabase.auth.linkIdentity(credenciais)
      : await supabase.auth.signInWithOAuth(credenciais);
    if (error) setErro(error.message);
  }

  return (
    <div className="flex flex-col gap-2">
      <button onClick={conectar} className="w-fit btn btn-primary">
        {label}
      </button>
      {erro && (
        <p className="alert alert-error" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
