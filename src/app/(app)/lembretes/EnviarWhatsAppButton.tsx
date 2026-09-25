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
          ? "btn btn-outline disabled:opacity-50"
          : "btn btn-success-outline disabled:opacity-50"
      }
    >
      {enviado ? "Enviar de novo" : "Enviar no WhatsApp"}
    </button>
  );
}
