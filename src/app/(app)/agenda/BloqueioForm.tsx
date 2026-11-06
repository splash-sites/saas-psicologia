"use client";

import { useActionState } from "react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import { useValidacao } from "@/lib/form/validacao";
import { ErroCampo } from "@/components/ErroCampo";
import Link from "next/link";
import type { FormState } from "./actions";
import { LIMITES } from "@/lib/limites";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
};


export function BloqueioForm({ action }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  const fe = state.fieldErrors ?? {};
  const { erros, formProps } = useValidacao();

  return (
    <form {...formProps} onSubmit={enviarSemLimpar(formAction)} className="flex flex-col gap-4">
      {state.error && (
        <p className="alert alert-error">
          {state.error}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Data *
        <input
          name="data"
          type="date"
          required
          className="input"
        />
        <ErroCampo nome="data" cliente={erros} servidor={fe.data} />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Início *
          <input
            name="hora_inicio"
            type="time"
            required
            className="input"
          />
          <ErroCampo nome="hora_inicio" cliente={erros} servidor={fe.hora_inicio} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Fim *
          <input
            name="hora_fim"
            type="time"
            required
            className="input"
          />
          <ErroCampo nome="hora_fim" cliente={erros} servidor={fe.hora_fim} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Motivo
        <input
          name="motivo"
          maxLength={LIMITES.bloqueio.motivo}
          placeholder="Férias, almoço, compromisso pessoal..."
          className="input"
        />
      </label>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary"
        >
          {pending ? "Salvando..." : "Bloquear horário"}
        </button>
        <Link
          href="/agenda/bloqueios"
          className="btn btn-outline"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
