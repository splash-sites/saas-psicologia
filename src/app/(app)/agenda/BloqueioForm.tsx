"use client";

import { useActionState } from "react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import Link from "next/link";
import type { FormState } from "./actions";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
};

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1 text-xs text-red-600">{errors[0]}</p>;
}

export function BloqueioForm({ action }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  const fe = state.fieldErrors ?? {};

  return (
    <form onSubmit={enviarSemLimpar(formAction)} className="flex flex-col gap-4">
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
        <FieldError errors={fe.data} />
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
          <FieldError errors={fe.hora_inicio} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Fim *
          <input
            name="hora_fim"
            type="time"
            required
            className="input"
          />
          <FieldError errors={fe.hora_fim} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Motivo
        <input
          name="motivo"
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
