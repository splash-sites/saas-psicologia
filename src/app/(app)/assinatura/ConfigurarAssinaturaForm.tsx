"use client";

import { useActionState } from "react";
import { configurarAssinatura, type FormState } from "./actions";

export function ConfigurarAssinaturaForm({ vencimento }: { vencimento: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    configurarAssinatura,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && <p className="alert alert-error">{state.error}</p>}

      <label className="flex max-w-xs flex-col gap-1 text-sm">
        CPF ou CNPJ *
        <input
          name="cpf_cnpj"
          required
          placeholder="Só números"
          inputMode="numeric"
          className="input"
        />
        <span className="text-xs text-slate-500">
          Exigido pelo Asaas para gerar a cobrança. Nunca coletamos dados de
          cartão — você escolhe Pix, boleto ou cartão na página do Asaas.
        </span>
        {state.fieldErrors?.cpf_cnpj && (
          <span className="text-xs text-red-600">{state.fieldErrors.cpf_cnpj[0]}</span>
        )}
      </label>

      <button type="submit" disabled={pending} className="btn btn-primary w-fit">
        {pending ? "Preparando pagamento..." : "Assinar plano"}
      </button>
      <p className="text-xs text-slate-500">
        Você será levada para a página de pagamento do Asaas (Pix, boleto ou
        cartão). A primeira cobrança acontece em {vencimento}, quando o teste
        grátis termina.
      </p>
    </form>
  );
}
