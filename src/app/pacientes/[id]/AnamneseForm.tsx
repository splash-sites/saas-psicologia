"use client";

import { useActionState } from "react";
import type { Anamnese } from "@/lib/pacientes/types";
import type { FormState } from "../actions";

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
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Demanda / queixa inicial
        <textarea
          name="demanda"
          rows={3}
          defaultValue={anamnese?.demanda ?? ""}
          className="rounded-md border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Objetivos do trabalho
        <textarea
          name="objetivos"
          rows={3}
          defaultValue={anamnese?.objetivos ?? ""}
          className="rounded-md border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Histórico relevante
        <textarea
          name="historico"
          rows={4}
          defaultValue={anamnese?.historico ?? ""}
          className="rounded-md border px-3 py-2"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-black/80 disabled:opacity-50"
      >
        {pending ? "Salvando..." : "Salvar anamnese"}
      </button>
    </form>
  );
}
