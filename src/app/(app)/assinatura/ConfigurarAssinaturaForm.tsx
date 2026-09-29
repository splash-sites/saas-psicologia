"use client";

import { useState, useTransition, type FormEvent } from "react";
import { configurarAssinatura, type FormState } from "./actions";

export function ConfigurarAssinaturaForm({ vencimento }: { vencimento: string }) {
  const [state, setState] = useState<FormState>({});
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // Só dá pra abrir popup como reação direta ao clique — se esperasse a
    // resposta do servidor pra abrir, o navegador bloqueia. Por isso a ação
    // do servidor é chamada aqui dentro (não via `action` do form): assim o
    // resultado chega direto pra esta função, sem depender de a página não
    // trocar de seção no meio do caminho (o que aconteceria com useActionState
    // — a seção "Cobrança" substitui este formulário assim que a assinatura
    // é configurada, e desmontaria o componente antes de mirar a aba).
    const aba = window.open("about:blank", "_blank");

    startTransition(async () => {
      const resultado = await configurarAssinatura({}, formData);
      setState(resultado);
      if (resultado.url && aba && !aba.closed) {
        aba.location.href = resultado.url;
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
