"use client";

import { useEffect, useRef } from "react";
import type { ErrosValidacao } from "@/lib/form/validacao";

/**
 * Erro de um campo, embaixo dele: o do navegador (campo vazio, formato...,
 * via useValidacao) ou o que voltou do servidor (fieldErrors do Zod). Mesmo
 * visual para os dois, inclusive a borda vermelha no campo (aria-invalid).
 */
export function ErroCampo({
  nome,
  cliente,
  servidor,
}: {
  nome: string;
  cliente?: ErrosValidacao;
  servidor?: string[];
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const mensagem = cliente?.[nome] ?? servidor?.[0];

  useEffect(() => {
    if (!mensagem) return;
    const campo = ref.current
      ?.closest("form")
      ?.querySelector(`[name="${CSS.escape(nome)}"]:not([type="hidden"]), [data-campo="${CSS.escape(nome)}"]`);
    campo?.setAttribute("aria-invalid", "true");
    return () => campo?.removeAttribute("aria-invalid");
  }, [mensagem, nome]);

  if (!mensagem) return null;
  return (
    <p ref={ref} className="mt-1 text-xs font-normal text-red-600">
      {mensagem}
    </p>
  );
}
