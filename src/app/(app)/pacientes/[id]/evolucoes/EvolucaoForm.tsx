"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CAMPOS_EVOLUCAO, type Evolucao } from "@/lib/prontuario/types";
import type { FormState } from "./actions";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  evolucao?: Evolucao;
  consultaId?: string;
  dataSessaoPadrao?: string;
  submitLabel: string;
  cancelHref: string;
};

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1 text-xs text-red-600">{errors[0]}</p>;
}

export function EvolucaoForm({
  action,
  evolucao,
  consultaId,
  dataSessaoPadrao,
  submitLabel,
  cancelHref,
}: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error && (
        <p className="alert alert-error">
          {state.error}
        </p>
      )}

      {(evolucao?.consulta_id ?? consultaId) && (
        <input
          type="hidden"
          name="consulta_id"
          value={evolucao?.consulta_id ?? consultaId}
        />
      )}

      <label className="flex w-fit flex-col gap-1 text-sm">
        Data da sessão *
        <input
          name="data_sessao"
          type="date"
          required
          defaultValue={
            evolucao?.data_sessao ??
            dataSessaoPadrao ??
            new Date().toISOString().slice(0, 10)
          }
          className="input"
        />
        <FieldError errors={fe.data_sessao} />
      </label>

      {CAMPOS_EVOLUCAO.map((campo) => (
        <label key={campo.nome} className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{campo.rotulo} *</span>
          <span className="text-xs text-slate-500">{campo.ajuda}</span>
          <textarea
            name={campo.nome}
            rows={4}
            required
            defaultValue={evolucao?.[campo.nome] ?? ""}
            className="input mt-1"
          />
          <FieldError errors={fe[campo.nome]} />
        </label>
      ))}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Notas técnicas privadas</span>
        <span className="text-xs text-slate-500">
          Anotações de uso exclusivo do psicólogo, separadas da evolução.
          Opcional.
        </span>
        <textarea
          name="notas_privadas"
          rows={3}
          defaultValue={evolucao?.notas_privadas ?? ""}
          className="input mt-1"
        />
        <FieldError errors={fe.notas_privadas} />
      </label>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary"
        >
          {pending ? "Salvando..." : submitLabel}
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
