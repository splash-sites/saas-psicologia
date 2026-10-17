"use client";

import { useState } from "react";
import { GOOGLE_AGENDA_ATIVA } from "@/lib/google/flag";
import { ESCOPO_AGENDA } from "@/lib/google/oauth";
import { useGoogleCodeClient } from "@/lib/google/useGoogleCodeClient";

// Com a integração ligada, o escopo da Agenda vai já no login para reaproveitar
// o mesmo consentimento na Agenda/Meet (item 12/17 do MVP) — um passo só.
// `calendar.events` e não `calendar`: o app só cria/edita eventos, e a
// verificação do Google exige o menor escopo que resolve.
const ESCOPO = `openid email profile${GOOGLE_AGENDA_ATIVA ? ` ${ESCOPO_AGENDA}` : ""}`;

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
        onClick={entrar}
        disabled={!pronto || carregando}
        className="btn btn-primary w-full"
      >
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
