"use client";

import { useEffect, useState } from "react";
import { horaBR } from "@/lib/agenda/datas";
import { minutosNoDiaBR } from "@/lib/agenda/grade";
import { minutosAteInicio } from "@/lib/agenda/estado";

// O que muda a cada minuto na tela (relógio, "Começa em N min", linha de agora)
// anda no próprio navegador, sem buscar a página no servidor. Começa do horário
// que o servidor usou (`inicialISO`), para a primeira renderização bater.

/** Hora atual, atualizada na virada de cada minuto (pausa com a aba escondida). */
export function useAgora(inicialISO: string): Date {
  const [agora, setAgora] = useState(() => new Date(inicialISO));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tique = () => {
      setAgora(new Date());
      clearTimeout(timer);
      if (document.visibilityState !== "visible") return;
      timer = setTimeout(tique, 60_000 - (Date.now() % 60_000) + 50);
    };
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === "visible") tique();
      else clearTimeout(timer);
    };
    tique();
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }, []);

  return agora;
}

export function HoraAgora({ inicialISO }: { inicialISO: string }) {
  const agora = useAgora(inicialISO);
  return <>{horaBR(agora.toISOString())}</>;
}

/** "N" de "Começa em N min" (0 quando já começou). */
export function MinutosAte({ inicio, inicialISO }: { inicio: string; inicialISO: string }) {
  const agora = useAgora(inicialISO);
  return <>{minutosAteInicio(inicio, agora)}</>;
}

/**
 * Elemento posicionado na altura do horário atual dentro da grade da semana.
 * Some fora da faixa exibida.
 */
export function NaAlturaDeAgora({
  inicialISO,
  minIni,
  minFim,
  horaPx,
  ajuste,
  className,
  rotulo = false,
  children,
}: {
  inicialISO: string;
  minIni: number;
  minFim: number;
  horaPx: number;
  /** Deslocamento em px a partir da linha (ex.: -8 para centralizar o rótulo). */
  ajuste: number;
  className?: string;
  /** true: mostra a hora atual como conteúdo. */
  rotulo?: boolean;
  children?: React.ReactNode;
}) {
  const agora = useAgora(inicialISO);
  const iso = agora.toISOString();
  const min = minutosNoDiaBR(iso);
  if (min < minIni || min >= minFim) return null;
  return (
    <div
      className={className}
      style={{ top: ((min - minIni) / 60) * horaPx + ajuste }}
      aria-hidden={rotulo ? undefined : true}
    >
      {rotulo ? horaBR(iso) : children}
    </div>
  );
}
