"use client";

import { useTransition } from "react";
import { marcarLembreteEnviado } from "./actions";

export function EnviarWhatsAppButton({
  href,
  consultaId,
  enviado,
}: {
  href: string;
  consultaId: string;
  enviado: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        // Abre o WhatsApp no clique (evita bloqueio de pop-up) e só depois registra.
        window.open(href, "_blank", "noopener,noreferrer");
        startTransition(async () => {
          await marcarLembreteEnviado(consultaId);
        });
      }}
      className={
        enviado
          ? "rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          : "rounded-md border border-green-600 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 disabled:opacity-50"
      }
    >
      {enviado ? "Enviar de novo" : "Enviar no WhatsApp"}
    </button>
  );
}
