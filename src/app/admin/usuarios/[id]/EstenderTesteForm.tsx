"use client";

import { useActionState } from "react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import { useValidacao } from "@/lib/form/validacao";
import { ErroCampo } from "@/components/ErroCampo";
import { estenderTeste, type FormState } from "../actions";

export function EstenderTesteForm({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(estenderTeste.bind(null, id), {});
  const { erros, formProps } = useValidacao();
  const fe = state.fieldErrors ?? {};

  return (
    <form {...formProps} onSubmit={enviarSemLimpar(formAction)} className="card flex flex-col gap-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Estender teste</h2>
        <p className="text-sm text-slate-600">
          Teste correndo: os dias somam ao fim atual. Teste vencido: contam a partir de hoje.
        </p>
      </div>
      {state.error && <p className="alert alert-error">{state.error}</p>}
      {state.ok && <p className="alert alert-success">{state.ok}</p>}
      <label className="flex flex-col gap-1 text-sm sm:max-w-xs">
        Dias *
        <input
          name="dias"
          type="number"
          required
          min={1}
          max={365}
          step={1}
          defaultValue={7}
          data-obrigatorio="Informe quantos dias."
          data-faixa="De 1 a 365 dias."
          className="input"
        />
        <ErroCampo nome="dias" cliente={erros} servidor={fe.dias} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Motivo *
        <input
          name="motivo"
          required
          minLength={3}
          maxLength={300}
          data-obrigatorio="Escreva o motivo."
          placeholder="Ex.: pediu mais tempo pelo WhatsApp"
          className="input"
        />
        <ErroCampo nome="motivo" cliente={erros} servidor={fe.motivo} />
      </label>
      <button type="submit" disabled={pending} className="btn btn-primary self-start">
        {pending ? "Estendendo..." : "Estender teste"}
      </button>
    </form>
  );
}
