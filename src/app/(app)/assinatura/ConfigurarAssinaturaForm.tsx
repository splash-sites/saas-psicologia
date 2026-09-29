"use client";

import { useActionState, useEffect, useRef } from "react";
import { configurarAssinatura, type FormState } from "./actions";

export function ConfigurarAssinaturaForm({ vencimento }: { vencimento: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    configurarAssinatura,
    {},
  );
  // Guarda a aba aberta no clique — só dá pra abrir popup como reação direta
  // ao gesto do usuário; se esperasse a resposta do servidor pra abrir, a
  // maioria dos navegadores bloqueia.
  const abaPagamento = useRef<Window | null>(null);

  useEffect(() => {
    if (state.url && abaPagamento.current && !abaPagamento.current.closed) {
      abaPagamento.current.location.href = state.url;
    }
  }, [state.url]);

  return (
    <form
      action={formAction}
      onSubmit={() => {
        abaPagamento.current = window.open("about:blank", "_blank");
      }}
      className="flex flex-col gap-4"
    >
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
        Abrimos uma nova aba com o pagamento do Asaas (Pix, boleto ou cartão).
        Se o navegador bloquear a aba, o link aparece aqui embaixo depois de
        confirmar. A primeira cobrança acontece em {vencimento}, quando o
        teste grátis termina.
      </p>
    </form>
  );
}
