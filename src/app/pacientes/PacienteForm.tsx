"use client";

import { useActionState } from "react";
import Link from "next/link";
import { PACIENTE_STATUS, PACIENTE_STATUS_LABEL } from "@/lib/pacientes/types";
import type { Paciente } from "@/lib/pacientes/types";
import type { FormState } from "./actions";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  paciente?: Paciente;
  submitLabel: string;
  cancelHref: string;
};

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1 text-xs text-red-600">{errors[0]}</p>;
}

export function PacienteForm({
  action,
  paciente,
  submitLabel,
  cancelHref,
}: Props) {
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
        Nome *
        <input
          name="nome"
          required
          defaultValue={paciente?.nome ?? ""}
          className="rounded-md border px-3 py-2"
        />
        <FieldError errors={fe.nome} />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          E-mail
          <input
            name="email"
            type="email"
            defaultValue={paciente?.email ?? ""}
            className="rounded-md border px-3 py-2"
          />
          <FieldError errors={fe.email} />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Telefone
          <input
            name="telefone"
            defaultValue={paciente?.telefone ?? ""}
            placeholder="(51) 99999-9999"
            className="rounded-md border px-3 py-2"
          />
          <FieldError errors={fe.telefone} />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Data de nascimento
          <input
            name="data_nascimento"
            type="date"
            defaultValue={paciente?.data_nascimento ?? ""}
            className="rounded-md border px-3 py-2"
          />
          <FieldError errors={fe.data_nascimento} />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          CPF
          <input
            name="cpf"
            defaultValue={paciente?.cpf ?? ""}
            className="rounded-md border px-3 py-2"
          />
          <FieldError errors={fe.cpf} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Endereço
        <input
          name="endereco"
          defaultValue={paciente?.endereco ?? ""}
          className="rounded-md border px-3 py-2"
        />
        <FieldError errors={fe.endereco} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Status
        <select
          name="status"
          defaultValue={paciente?.status ?? "ativo"}
          className="rounded-md border px-3 py-2"
        >
          {PACIENTE_STATUS.map((s) => (
            <option key={s} value={s}>
              {PACIENTE_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Observações
        <textarea
          name="observacoes"
          rows={3}
          defaultValue={paciente?.observacoes ?? ""}
          className="rounded-md border px-3 py-2"
        />
        <FieldError errors={fe.observacoes} />
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="aceita_lembretes"
          defaultChecked={paciente?.aceita_lembretes ?? true}
          className="mt-1"
        />
        <span>
          Aceita receber lembretes de consulta
          <span className="block text-xs text-gray-500">
            WhatsApp (enviado por você) e convite por e-mail no Google Agenda.
            Desmarque se o paciente não quiser ser contatado.
          </span>
        </span>
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
