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
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
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
          className="rounded-md border px-3 py-2"
        />
        <FieldError errors={fe.data_sessao} />
      </label>

      {CAMPOS_EVOLUCAO.map((campo) => (
        <label key={campo.nome} className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{campo.rotulo} *</span>
          <span className="text-xs text-gray-500">{campo.ajuda}</span>
          <textarea
            name={campo.nome}
            rows={4}
            required
            defaultValue={evolucao?.[campo.nome] ?? ""}
            className="mt-1 rounded-md border px-3 py-2"
          />
          <FieldError errors={fe[campo.nome]} />
        </label>
      ))}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Notas técnicas privadas</span>
        <span className="text-xs text-gray-500">
          Anotações de uso exclusivo da psicóloga, separadas da evolução.
          Opcional.
        </span>
        <textarea
          name="notas_privadas"
          rows={3}
          defaultValue={evolucao?.notas_privadas ?? ""}
          className="mt-1 rounded-md border px-3 py-2"
        />
        <FieldError errors={fe.notas_privadas} />
      </label>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-black/80 disabled:opacity-50"
        >
          {pending ? "Salvando..." : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
