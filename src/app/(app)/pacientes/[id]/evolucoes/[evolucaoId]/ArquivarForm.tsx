"use client";

import { useActionState, useState } from "react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import type { FormState } from "../actions";

export function ArquivarForm({
  action,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [aberto, setAberto] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="text-sm text-red-600 hover:underline"
      >
        Arquivar evolução
      </button>
    );
  }

  return (
    <form onSubmit={enviarSemLimpar(formAction)} className="flex flex-col gap-2">
      <p className="text-sm text-slate-600">
        A evolução deixa de aparecer na timeline ativa, mas continua guardada
        (exigência de guarda mínima de 5 anos). Informe o motivo:
      </p>
      {state.error && (
        <p className="text-sm text-red-700">{state.error}</p>
      )}
      <input
        name="motivo"
        required
        minLength={3}
        placeholder="Ex.: registro duplicado, erro de digitação corrigido em nova evolução"
        className="rounded-md border px-3 py-2 text-sm"
      />
      {state.fieldErrors?.motivo && (
        <p className="text-xs text-red-600">{state.fieldErrors.motivo[0]}</p>
      )}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-danger"
        >
          {pending ? "Arquivando..." : "Confirmar arquivamento"}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="btn btn-outline"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
