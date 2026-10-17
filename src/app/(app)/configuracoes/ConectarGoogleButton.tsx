"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ESCOPO_AGENDA } from "@/lib/google/oauth";
import { useGoogleCodeClient } from "@/lib/google/useGoogleCodeClient";

// Conecta (ou reconecta) a Google Agenda à conta logada, seja qual for o jeito
// de login. O token fica ligado a esta conta; a sessão não muda.
export function ConectarGoogleButton({ label, clientId }: { label: string; clientId: string }) {
  const router = useRouter();
  const { pronto, pedirCodigo } = useGoogleCodeClient(clientId, ESCOPO_AGENDA);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function conectar() {
    setErro(null);
    let pedido;
    try {
      pedido = await pedirCodigo();
    } catch {
      return;
    }
    setEnviando(true);
    const res = await fetch("/api/google/conectar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pedido),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; resultado?: string };
    setEnviando(false);
    if (json.ok) {
      router.refresh();
    } else if (json.resultado === "sem_permissao") {
      router.push("/configuracoes?google=sem-permissao");
    } else {
      setErro("Não foi possível conectar a Google Agenda. Tente novamente.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button onClick={conectar} disabled={!pronto || enviando} className="w-fit btn btn-primary">
        {enviando ? "Conectando..." : label}
      </button>
      {erro && (
        <p className="alert alert-error" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
