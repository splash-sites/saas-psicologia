"use client";

import { useActionState } from "react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import { useValidacao } from "@/lib/form/validacao";
import { ErroCampo } from "@/components/ErroCampo";
import { editarCupom, type FormState } from "../actions";

export function EditarCupomForm({
  id,
  validoAte,
  limiteUsos,
  usos,
}: {
  id: string;
  validoAte: string | null;
  limiteUsos: number | null;
  usos: number;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(editarCupom.bind(null, id), {});
  const { erros, formProps } = useValidacao();
  const fe = state.fieldErrors ?? {};

  return (
    <form {...formProps} onSubmit={enviarSemLimpar(formAction)} className="card flex flex-col gap-4 sm:p-6">
      <h2 className="text-lg font-semibold">Validade e limite</h2>
      {state.error && <p className="alert alert-error">{state.error}</p>}
      {state.ok && <p className="alert alert-success">Salvo.</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Válido até
          <input name="valido_ate" type="date" defaultValue={validoAte ?? ""} className="input" />
          <span className="text-xs text-slate-500">Em branco: sem validade.</span>
          <ErroCampo nome="valido_ate" cliente={erros} servidor={fe.valido_ate} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Limite de usos
          <input
            name="limite_usos"
            type="number"
            min={Math.max(1, usos)}
            step={1}
            defaultValue={limiteUsos ?? ""}
            data-faixa={`Já foram ${usos} usos: o limite precisa ser de pelo menos ${Math.max(1, usos)}.`}
            placeholder="Sem limite"
            className="input"
          />
          <span className="text-xs text-slate-500">Em branco: sem limite.</span>
          <ErroCampo nome="limite_usos" cliente={erros} servidor={fe.limite_usos} />
        </label>
      </div>
      <button type="submit" disabled={pending} className="btn btn-primary self-start">
        {pending ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}
