"use client";

import { useActionState, useState } from "react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
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
  /** Vindos do clique num horário vazio da agenda. */
  dataPadrao?: string;
  horaPadrao?: string;
};

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1 text-xs text-red-600">{errors[0]}</p>;
}

export function ConsultaForm({ action, pacientes, dataPadrao, horaPadrao }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  const [recorrente, setRecorrente] = useState(false);
  const fe = state.fieldErrors ?? {};

  return (
    <form onSubmit={enviarSemLimpar(formAction)} className="flex flex-col gap-4">
      {state.error && (
        <p className="alert alert-error">
          {state.error}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Paciente *
        <select name="paciente_id" required className="input">
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
            defaultValue={dataPadrao}
            required
            className="input"
          />
          <FieldError errors={fe.data} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Hora *
          <input
            name="hora"
            type="time"
            defaultValue={horaPadrao}
            required
            className="input"
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
            className="input"
          />
          <FieldError errors={fe.duracao_min} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Modalidade *
        <select name="modalidade" required className="input">
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
            className="input"
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
              className="input"
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
          className="input"
        />
      </label>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary"
        >
          {pending ? "Agendando..." : "Agendar"}
        </button>
        <Link
          href="/agenda"
          className="btn btn-outline"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
