"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { GOOGLE_AGENDA_ATIVA } from "@/lib/google/flag";
import { ESCOPO_AGENDA } from "@/lib/google/oauth";
import { useGoogleCodeClient } from "@/lib/google/useGoogleCodeClient";

// Com a integração ligada, o escopo da Agenda vai já no login para reaproveitar
// o mesmo consentimento na Agenda/Meet (item 12/17 do MVP) — um passo só.
// `calendar.events` e não `calendar`: o app só cria/edita eventos, e a
// verificação do Google exige o menor escopo que resolve.
const ESCOPO = `openid email profile${GOOGLE_AGENDA_ATIVA ? ` ${ESCOPO_AGENDA}` : ""}`;

// "G" oficial nas quatro cores, sem alterar proporção nem cor (diretrizes de
// marca do Google para o botão de login: fundo branco, contorno neutro).
function LogoGoogle() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px]" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function LoginButton({ clientId }: { clientId: string }) {
  const { pronto, pedirCodigo } = useGoogleCodeClient(clientId, ESCOPO);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar() {
    setErro(null);
    let pedido;
    try {
      pedido = await pedirCodigo();
    } catch {
      return; // fechou o popup ou negou: nada a mostrar
    }
    setCarregando(true);
    const res = await fetch("/api/google/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pedido),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; destino?: string };
    if (!json.ok) {
      setCarregando(false);
      setErro("Não foi possível entrar com o Google. Tente novamente.");
      return;
    }
    // Recarga completa: os cookies da sessão acabaram de ser gravados.
    window.location.assign(json.destino ?? "/dashboard");
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={entrar}
        disabled={!pronto || carregando}
        aria-busy={carregando}
        className="btn btn-outline w-full text-slate-900"
      >
        {carregando ? (
          <Loader2 className="size-[18px] animate-spin" aria-hidden />
        ) : (
          <LogoGoogle />
        )}
        {carregando ? "Entrando..." : "Entrar com Google"}
      </button>
      {erro && (
        <p className="alert alert-error" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
