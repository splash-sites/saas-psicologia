"use client";

import { useActionState } from "react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import type { Anamnese } from "@/lib/pacientes/types";
import type { FormState } from "../actions";
import { LIMITES } from "@/lib/limites";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  anamnese?: Anamnese | null;
};

export function AnamneseForm({ action, anamnese }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );

  return (
    <form onSubmit={enviarSemLimpar(formAction)} className="flex flex-col gap-4">
      {state.error && (
        <p className="alert alert-error">
          {state.error}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Demanda / queixa inicial
        <textarea
          name="demanda"
          maxLength={LIMITES.textoClinico}
          rows={3}
          defaultValue={anamnese?.demanda ?? ""}
          className="input"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Objetivos do trabalho
        <textarea
          name="objetivos"
          maxLength={LIMITES.textoClinico}
          rows={3}
          defaultValue={anamnese?.objetivos ?? ""}
          className="input"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Histórico relevante
        <textarea
          name="historico"
          maxLength={LIMITES.textoClinico}
          rows={4}
          defaultValue={anamnese?.historico ?? ""}
          className="input"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-fit btn btn-primary"
      >
        {pending ? "Salvando..." : "Salvar anamnese"}
      </button>
    </form>
  );
}
