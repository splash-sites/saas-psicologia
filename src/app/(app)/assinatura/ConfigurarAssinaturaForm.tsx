"use client";

import { useState, useTransition, type FormEvent } from "react";
import { configurarAssinatura, type FormState } from "./actions";
import { ASSINATURA_PLANO, PLANOS, type AssinaturaPlano } from "@/lib/assinatura/types";
import { mascararCpfCnpj, validarCpfCnpj } from "@/lib/assinatura/cpfCnpj";

const MSG_CPF_CNPJ_INVALIDO = "CPF ou CNPJ inválido. Confira os números.";

// vencimento = fim do teste grátis ainda por vir; null = o teste já acabou e a
// primeira cobrança vence hoje (mesma regra de assinarPlano).
export function ConfigurarAssinaturaForm({ vencimento }: { vencimento: string | null }) {
  const [state, setState] = useState<FormState>({});
  const [pending, startTransition] = useTransition();
  const [plano, setPlano] = useState<AssinaturaPlano>("mensal");
  const [cpfCnpj, setCpfCnpj] = useState("");
  // Erro só depois de sair do campo ou tentar enviar — não enquanto digita.
  const [erroCpfCnpj, setErroCpfCnpj] = useState<string | null>(null);

  function conferirCpfCnpj(): boolean {
    const ok = validarCpfCnpj(cpfCnpj).valido;
    setErroCpfCnpj(ok ? null : MSG_CPF_CNPJ_INVALIDO);
    return ok;
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Antes de abrir a aba: com documento inválido não há cobrança para mostrar.
    // O servidor valida de novo (configurarAssinatura).
    if (!conferirCpfCnpj()) return;
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

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Plano</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {ASSINATURA_PLANO.map((id) => {
            const p = PLANOS[id];
            const selecionado = plano === id;
            return (
              <label
                key={id}
                className={`flex cursor-pointer flex-col gap-1 rounded-xl border bg-white p-3 text-sm shadow-sm ${
                  selecionado ? "border-teal-600 ring-1 ring-teal-600" : "border-slate-200"
                }`}
              >
                <span className="flex items-center gap-2 font-medium">
                  <input
                    type="radio"
                    name="plano"
                    value={id}
                    checked={selecionado}
                    onChange={() => setPlano(id)}
                  />
                  {p.label}
                </span>
                <span>R$ {p.valor.toFixed(2).replace(".", ",")}</span>
                {p.economia && <span className="text-xs text-teal-700">{p.economia}</span>}
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="flex max-w-xs flex-col gap-1 text-sm">
        CPF ou CNPJ *
        <input
          name="cpf_cnpj"
          required
          value={cpfCnpj}
          onChange={(e) => {
            setCpfCnpj(mascararCpfCnpj(e.target.value));
            if (erroCpfCnpj) setErroCpfCnpj(null);
          }}
          onBlur={() => cpfCnpj && conferirCpfCnpj()}
          placeholder="000.000.000-00"
          inputMode="numeric"
          autoComplete="off"
          maxLength={18}
          aria-invalid={Boolean(erroCpfCnpj || state.fieldErrors?.cpf_cnpj)}
          aria-describedby="cpf-cnpj-ajuda"
          className="input"
        />
        <span id="cpf-cnpj-ajuda" className="text-xs text-slate-500">
          O Asaas exige o CPF ou CNPJ para gerar a cobrança. Não coletamos
          dados de cartão: você escolhe Pix, boleto ou cartão na página do
          Asaas.
        </span>
        {(erroCpfCnpj ?? state.fieldErrors?.cpf_cnpj?.[0]) && (
          <span className="text-xs text-red-600" role="alert">
            {erroCpfCnpj ?? state.fieldErrors?.cpf_cnpj?.[0]}
          </span>
        )}
      </label>

      <button type="submit" disabled={pending} className="btn btn-primary w-fit">
        {pending ? "Preparando pagamento..." : "Assinar plano"}
      </button>
      <p className="text-xs text-slate-500">
        Abrimos uma nova aba com o pagamento do Asaas (Pix, boleto ou cartão).
        Se o navegador bloquear a aba, o link aparece aqui embaixo depois de
        confirmar.{" "}
        {vencimento
          ? `A primeira cobrança acontece em ${vencimento}, quando o teste grátis termina.`
          : "A primeira cobrança vence hoje."}
      </p>
    </form>
  );
}
