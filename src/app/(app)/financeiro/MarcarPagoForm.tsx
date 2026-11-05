"use client";

import { useActionState, useState } from "react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import { useValidacao } from "@/lib/form/validacao";
import { ErroCampo } from "@/components/ErroCampo";
import { hojeBR } from "@/lib/agenda/datas";
import type { FormState } from "./actions";

export function MarcarPagoForm({
  action,
  formaPadrao,
  compacto = false,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  // Forma já informada no lançamento — vem preenchida, sem redigitar.
  formaPadrao?: string | null;
  /** Dentro de uma lista: botão pequeno, como as outras ações de linha. */
  compacto?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  const { erros, formProps } = useValidacao();

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={`btn btn-success-outline${compacto ? " btn-sm" : ""}`}
      >
        Marcar como pago
      </button>
    );
  }

  return (
    <form {...formProps} onSubmit={enviarSemLimpar(formAction)} className="flex flex-wrap items-end gap-2">
      {state.error && (
        <p className="w-full text-sm text-red-700">{state.error}</p>
      )}
      <label className="flex flex-col gap-1 text-xs">
        Data do pagamento
        <input
          name="data_pagamento"
          type="date"
          required
          defaultValue={hojeBR()}
          className="input w-auto"
        />
        <ErroCampo nome="data_pagamento" cliente={erros} servidor={state.fieldErrors?.data_pagamento} />
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
