"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { proximaRecarga } from "@/lib/agenda/marcos";

/**
 * Busca a página de novo no servidor só quando algo que depende do horário
 * muda de estado (Meet em destaque, "em andamento", sessão encerrada → evolução
 * pendente, virada do dia) — os `marcos`, calculados pela página.
 *
 * O que muda a cada minuto (relógio, "Começa em N min", linha de agora) é
 * atualizado no navegador por src/components/Relogio.tsx, sem requisição.
 *
 * Aba escondida não agenda nada. Ao voltar, recarrega se um marco passou ou se
 * ficou fora por mais de `intervaloMin`. Antes (até 2026-11-06) era um
 * router.refresh a cada 60 s, inclusive com a aba escondida: no painel, 15
 * consultas ao banco por minuto por psicóloga parada.
 */
export function AutoRefresh({
  marcos = [],
  intervaloMin = 10,
}: {
  marcos?: string[];
  intervaloMin?: number;
}) {
  const router = useRouter();
  const ultima = useRef(0);
  const chave = marcos.join(",");

  useEffect(() => {
    if (ultima.current === 0) ultima.current = Date.now();
    const lista = chave ? chave.split(",") : [];
    let timer: ReturnType<typeof setTimeout> | undefined;

    const recarregar = () => {
      ultima.current = Date.now();
      router.refresh();
    };

    const agendar = () => {
      clearTimeout(timer);
      if (document.visibilityState !== "visible") return;
      const espera = proximaRecarga(lista, Date.now(), ultima.current, intervaloMin);
      if (espera === 0) recarregar();
      else timer = setTimeout(recarregar, espera);
    };

    const aoMudarVisibilidade = () => {
      if (document.visibilityState === "visible") agendar();
      else clearTimeout(timer);
    };

    agendar();
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }, [router, chave, intervaloMin]);

  return null;
}
