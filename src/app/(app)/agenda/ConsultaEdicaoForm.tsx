"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  MODALIDADES,
  MODALIDADE_LABEL,
  CONSULTA_STATUS,
  CONSULTA_STATUS_LABEL,
} from "@/lib/agenda/types";
import type { FormState } from "./actions";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: {
    data: string;
    hora: string;
    duracao_min: number;
    modalidade: string;
    status: string;
    observacoes: string | null;
  };
  cancelHref: string;
};

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1 text-xs text-red-600">{errors[0]}</p>;
}

export function ConsultaEdicaoForm({ action, defaults, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <p className="alert alert-error">
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          Data
          <input
            name="data"
            type="date"
            defaultValue={defaults.data}
            required
            className="input"
          />
          <FieldError errors={fe.data} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Hora
          <input
            name="hora"
            type="time"
            defaultValue={defaults.hora}
            required
            className="input"
          />
          <FieldError errors={fe.hora} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Duração (min)
          <input
            name="duracao_min"
            type="number"
            defaultValue={defaults.duracao_min}
            min={15}
            max={480}
            step={5}
            required
            className="input"
          />
          <FieldError errors={fe.duracao_min} />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Modalidade
          <select
            name="modalidade"
            defaultValue={defaults.modalidade}
            className="input"
          >
            {MODALIDADES.map((m) => (
              <option key={m} value={m}>
                {MODALIDADE_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Status
          <select
            name="status"
            defaultValue={defaults.status}
            className="input"
          >
            {CONSULTA_STATUS.map((s) => (
              <option key={s} value={s}>
                {CONSULTA_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Observações
        <textarea
          name="observacoes"
          rows={2}
          defaultValue={defaults.observacoes ?? ""}
          className="input"
        />
      </label>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary"
        >
          {pending ? "Salvando..." : "Salvar"}
        </button>
        <Link
          href={cancelHref}
          className="btn btn-outline"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
