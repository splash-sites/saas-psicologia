"use client";

import { useActionState, useState } from "react";
import { excluirCupom, type FormState } from "../actions";

/** Só aparece para cupom sem uso. Pede confirmação antes de apagar de vez. */
export function ExcluirCupom({ id, codigo }: { id: string; codigo: string }) {
  const [state, formAction, pending] = useActionState<FormState>(excluirCupom.bind(null, id), {});
  const [confirmando, setConfirmando] = useState(false);

  return (
    <section className="flex flex-col gap-2 border-t pt-4">
      {state.error && <p className="alert alert-error">{state.error}</p>}
      {confirmando ? (
        <form action={formAction} className="flex flex-wrap items-center gap-3 text-sm">
          <span>
            Excluir o cupom <strong>{codigo}</strong> de vez? Não dá para desfazer.
          </span>
          <button type="submit" disabled={pending} className="btn btn-danger">
            {pending ? "Excluindo..." : "Sim, excluir"}
          </button>
          <button type="button" onClick={() => setConfirmando(false)} className="btn btn-outline">
            Cancelar
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="self-start text-sm text-red-600 hover:opacity-80"
        >
          Excluir cupom
        </button>
      )}
      <p className="text-xs text-slate-400">Só cupom que ninguém usou pode ser excluído. Com uso, pause.</p>
    </section>
  );
}
