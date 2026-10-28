"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Enquanto a cobrança está em aberto, recarrega os dados da página de tempos
// em tempos e ao voltar para esta aba (a pessoa paga na aba do Asaas). Quem
// muda o status é o webhook; aqui só se relê o banco, sem chamar o Asaas.
const INTERVALO_MS = 5_000;
const DURACAO_MAX_MS = 15 * 60_000;

export function AtualizarAoPagar() {
  const router = useRouter();

  useEffect(() => {
    const inicio = Date.now();
    const id = window.setInterval(() => {
      if (Date.now() - inicio > DURACAO_MAX_MS) {
        window.clearInterval(id);
        return;
      }
      if (document.visibilityState === "visible") router.refresh();
    }, INTERVALO_MS);

    function aoVoltar() {
      if (document.visibilityState === "visible") router.refresh();
    }
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [router]);

  return null;
}
