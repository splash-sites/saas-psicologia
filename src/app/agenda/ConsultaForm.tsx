"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  MODALIDADES,
  MODALIDADE_LABEL,
  RECORRENCIAS,
  RECORRENCIA_LABEL,
} from "@/lib/agenda/types";
import type { FormState } from "./actions";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  pacientes: { id: string; nome: string }[];
};

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1 text-xs text-red-600">{errors[0]}</p>;
}

export function ConsultaForm({ action, pacientes }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  const [recorrente, setRecorrente] = useState(false);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Paciente *
        <select name="paciente_id" required className="rounded-md border px-3 py-2">
          <option value="">Selecione...</option>
          {pacientes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
        <FieldError errors={fe.paciente_id} />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
        <label className="flex flex-col gap-1 text-sm">
          Hora *
          <input
            name="hora"
            type="time"
            required
            className="rounded-md border px-3 py-2"
          />
          <FieldError errors={fe.hora} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Duração (min) *
          <input
            name="duracao_min"
            type="number"
            defaultValue={50}
            min={15}
            max={480}
            step={5}
            required
            className="rounded-md border px-3 py-2"
          />
          <FieldError errors={fe.duracao_min} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Modalidade *
        <select name="modalidade" required className="rounded-md border px-3 py-2">
          {MODALIDADES.map((m) => (
            <option key={m} value={m}>
              {MODALIDADE_LABEL[m]}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Recorrência
          <select
            name="recorrencia"
            defaultValue="nenhuma"
            onChange={(e) => setRecorrente(e.target.value !== "nenhuma")}
            className="rounded-md border px-3 py-2"
          >
            {RECORRENCIAS.map((r) => (
              <option key={r} value={r}>
                {RECORRENCIA_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        {recorrente && (
          <label className="flex flex-col gap-1 text-sm">
            Nº de ocorrências
            <input
              name="ocorrencias"
              type="number"
              defaultValue={4}
              min={2}
              max={52}
              className="rounded-md border px-3 py-2"
            />
            <FieldError errors={fe.ocorrencias} />
          </label>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Observações
        <textarea
          name="observacoes"
          rows={2}
          className="rounded-md border px-3 py-2"
        />
      </label>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-black/80 disabled:opacity-50"
        >
          {pending ? "Agendando..." : "Agendar"}
        </button>
        <Link
          href="/agenda"
          className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
