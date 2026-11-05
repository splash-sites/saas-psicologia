"use client";

import { useState, useTransition } from "react";
import { verificarPagamentoAgora } from "./actions";

export function VerificarPagamentoButton() {
  const [pending, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await verificarPagamentoAgora();
            setMensagem(r.mensagem);
          })
        }
        className="btn btn-outline"
      >
        {pending ? "Verificando..." : "Já paguei, verificar"}
      </button>
      {mensagem && <p className="text-xs text-slate-600">{mensagem}</p>}
    </div>
  );
}
