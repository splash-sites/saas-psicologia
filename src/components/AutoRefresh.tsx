"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Reavalia a página a cada minuto (e ao voltar para a aba), para que o que
// depende do horário — botão do Meet em destaque, "em andamento", evolução
// pendente — mude sozinho sem a pessoa recarregar.
export function AutoRefresh({ segundos = 60 }: { segundos?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), segundos * 1000);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [router, segundos]);

  return null;
}
