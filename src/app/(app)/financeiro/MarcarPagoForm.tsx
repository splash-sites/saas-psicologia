"use client";

import { useActionState, useState } from "react";
import type { FormState } from "./actions";

export function MarcarPagoForm({
  action,
  formaPadrao,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  // Forma já informada no lançamento — vem preenchida, sem redigitar.
  formaPadrao?: string | null;
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
        className="btn btn-success-outline"
      >
        Marcar como pago
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      {state.error && (
        <p className="w-full text-sm text-red-700">{state.error}</p>
      )}
      <label className="flex flex-col gap-1 text-xs">
        Data do pagamento
        <input
          name="data_pagamento"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="input w-auto"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        Forma
        <input
          name="forma_pagamento"
          placeholder="Pix, dinheiro..."
          defaultValue={formaPadrao ?? ""}
          className="input w-auto"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="btn btn-success"
      >
        {pending ? "Salvando..." : "Confirmar"}
      </button>
      <button
        type="button"
        onClick={() => setAberto(false)}
        className="btn btn-outline"
      >
        Cancelar
      </button>
    </form>
  );
}
