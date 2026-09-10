"use client";

import { useActionState } from "react";
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
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Data *
        <input
          name="data"
          type="date"
          required
          className="rounded-md border px-3 py-2"
        />
        <FieldError errors={fe.data} />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Início *
          <input
            name="hora_inicio"
            type="time"
            required
            className="rounded-md border px-3 py-2"
          />
          <FieldError errors={fe.hora_inicio} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Fim *
          <input
            name="hora_fim"
            type="time"
            required
            className="rounded-md border px-3 py-2"
          />
          <FieldError errors={fe.hora_fim} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Motivo
        <input
          name="motivo"
          placeholder="Férias, almoço, compromisso pessoal..."
          className="rounded-md border px-3 py-2"
        />
      </label>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-black/80 disabled:opacity-50"
        >
          {pending ? "Salvando..." : "Bloquear horário"}
        </button>
        <Link
          href="/agenda/bloqueios"
          className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
