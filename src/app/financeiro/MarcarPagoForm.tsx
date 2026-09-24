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
        className="rounded-md border border-green-600 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50"
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
          className="rounded-md border px-2 py-1 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        Forma
        <input
          name="forma_pagamento"
          placeholder="Pix, dinheiro..."
          defaultValue={formaPadrao ?? ""}
          className="rounded-md border px-2 py-1 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
      >
        {pending ? "Salvando..." : "Confirmar"}
      </button>
      <button
        type="button"
        onClick={() => setAberto(false)}
        className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
      >
        Cancelar
      </button>
    </form>
  );
}
