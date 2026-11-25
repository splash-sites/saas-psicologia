"use client";

import { useActionState, useState } from "react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import { useValidacao } from "@/lib/form/validacao";
import { ErroCampo } from "@/components/ErroCampo";
import { hojeBR } from "@/lib/agenda/datas";
import { SelectFormaPagamento } from "../SelectFormaPagamento";
import type { FormState } from "../actions";

/**
 * "Dar baixa" do lançamento (canvas "Lançamento"): clicar não muda nada, só
 * abre "Pago em" (hoje) e "Forma de pagamento"; confirmar registra.
 */
export function DarBaixa({
  action,
  formaPadrao,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  formaPadrao: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const { erros, formProps } = useValidacao();

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="h-12 w-full rounded-xl bg-[#0F766E] text-base font-bold text-white hover:bg-[#0B5A54] sm:w-auto sm:self-start sm:px-10"
      >
        Dar baixa
      </button>
    );
  }

  return (
    <form {...formProps} onSubmit={enviarSemLimpar(formAction)} className="flex flex-col gap-3">
      {state.error && <p className="alert alert-error">{state.error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Pago em
          <input name="data_pagamento" type="date" required defaultValue={hojeBR()} className="input" />
          <ErroCampo nome="data_pagamento" cliente={erros} servidor={state.fieldErrors?.data_pagamento} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Forma de pagamento
          <SelectFormaPagamento defaultValue={formaPadrao} />
        </label>
      </div>
      <div className="grid grid-cols-[1fr_1.4fr] gap-2 sm:flex sm:justify-end">
        <button type="button" onClick={() => setAberto(false)} className="btn btn-outline">
          Cancelar
        </button>
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Salvando…" : "Confirmar baixa"}
        </button>
      </div>
    </form>
  );
}
