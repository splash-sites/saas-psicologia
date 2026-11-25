"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { StickyNote } from "lucide-react";

/**
 * Observação da consulta no topo do painel: até 2 linhas, com "Ver mais"
 * só quando o texto passa disso.
 */
export function ObservacaoConsulta({ texto }: { texto: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [aberta, setAberta] = useState(false);
  const [corta, setCorta] = useState(false);

  // Mede com o corte aplicado: o texto passa das 2 linhas?
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !aberta) setCorta(el.scrollHeight > el.clientHeight + 1);
  }, [texto, aberta]);

  return (
    <span className="flex items-start gap-2 text-slate-600">
      <StickyNote className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
      <span className="flex min-w-0 flex-col items-start gap-0.5">
        <span ref={ref} className={`whitespace-pre-wrap break-words ${aberta ? "" : "line-clamp-2"}`}>
          <span className="font-medium text-slate-700">Obs.:</span> {texto}
        </span>
        {(corta || aberta) && (
          <button
            type="button"
            onClick={() => setAberta((v) => !v)}
            aria-expanded={aberta}
            className="text-xs font-medium text-teal-800 hover:opacity-80"
          >
            {aberta ? "Ver menos" : "Ver mais"}
          </button>
        )}
      </span>
    </span>
  );
}
