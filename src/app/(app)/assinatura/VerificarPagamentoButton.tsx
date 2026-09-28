"use client";

import { useState, useTransition } from "react";
import { verificarPagamentoAgora } from "./actions";

export function VerificarPagamentoButton() {
  const [pending, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await verificarPagamentoAgora();
            setMensagem(r.mensagem);
          })
        }
        className="btn btn-outline btn-sm"
      >
        {pending ? "Verificando..." : "Já paguei, verificar agora"}
      </button>
      {mensagem && <p className="text-xs text-slate-600">{mensagem}</p>}
    </div>
  );
}
