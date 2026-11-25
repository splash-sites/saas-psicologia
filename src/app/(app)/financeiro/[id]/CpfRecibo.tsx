"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { formatarCpf } from "@/lib/pacientes/formatacao";

/**
 * CPF para o recibo: aparece mascarado ("•••.456.789-••"), com "Mostrar" e
 * "Copiar" (para colar no Receita Saúde). Continua com data-sensivel: no modo
 * privado (Alt+O) fica borrado mesmo depois de "Mostrar".
 */
export function CpfRecibo({ cpf }: { cpf: string }) {
  const [visivel, setVisivel] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const completo = formatarCpf(cpf);
  const mascarado = `•••.${completo.slice(4, 11)}-••`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(cpf);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setVisivel(true);
    }
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <strong className="tabular-nums" data-sensivel>
        {visivel ? completo : mascarado}
      </strong>
      <button
        type="button"
        onClick={() => setVisivel(!visivel)}
        aria-pressed={visivel}
        className="min-h-9 rounded-lg border border-[#DFEBE7] bg-white px-2.5 text-[13px] font-semibold text-[#0F766E] hover:bg-[#F2FAF8]"
      >
        {visivel ? "Ocultar" : "Mostrar"}
      </button>
      <button
        type="button"
        onClick={copiar}
        aria-label="Copiar CPF"
        className="flex min-h-9 items-center gap-1 rounded-lg border border-[#DFEBE7] bg-white px-2.5 text-[13px] font-semibold text-[#0F766E] hover:bg-[#F2FAF8]"
      >
        {copiado ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        {copiado ? "Copiado" : "Copiar"}
      </button>
    </span>
  );
}
