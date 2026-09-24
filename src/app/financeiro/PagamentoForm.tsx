"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Pagamento } from "@/lib/financeiro/types";
import type { FormState } from "./actions";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  pacientes: { id: string; nome: string }[];
  pagamento?: Pagamento;
  pacienteIdPadrao?: string;
  consultaIdPadrao?: string;
  dataPadrao?: string;
  submitLabel: string;
  cancelHref: string;
};

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1 text-xs text-red-600">{errors[0]}</p>;
}

export function PagamentoForm({
  action,
  pacientes,
  pagamento,
  pacienteIdPadrao,
  consultaIdPadrao,
  dataPadrao,
  submitLabel,
  cancelHref,
}: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  const fe = state.fieldErrors ?? {};
  const hoje = new Date().toISOString().slice(0, 10);
  const dataRef = pagamento?.data_referencia ?? dataPadrao ?? hoje;

  // Novo lançamento começa como "recebido" (caso mais comum: registrar um
  // pagamento que já caiu). Na edição, reflete o estado atual.
  const [situacao, setSituacao] = useState<"recebido" | "a_receber">(
    pagamento ? (pagamento.status === "pago" ? "recebido" : "a_receber") : "recebido",
  );
  const recebido = situacao === "recebido";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {(pagamento?.consulta_id ?? consultaIdPadrao) && (
        <input
          type="hidden"
          name="consulta_id"
          value={pagamento?.consulta_id ?? consultaIdPadrao}
        />
      )}

      <label className="flex flex-col gap-1 text-sm">
        Paciente *
        <select
          name="paciente_id"
          required
          defaultValue={pagamento?.paciente_id ?? pacienteIdPadrao ?? ""}
          className="rounded-md border px-3 py-2"
        >
          <option value="">Selecione...</option>
          {pacientes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
        <FieldError errors={fe.paciente_id} />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Valor (R$) *
          <input
            name="valor"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={pagamento?.valor ?? ""}
            className="rounded-md border px-3 py-2"
          />
          <FieldError errors={fe.valor} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Referente a (sessão/mês) *
          <input
            name="data_referencia"
            type="date"
            required
            defaultValue={dataRef}
            className="rounded-md border px-3 py-2"
          />
          <FieldError errors={fe.data_referencia} />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1">Situação *</legend>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="situacao"
              value="recebido"
              checked={recebido}
              onChange={() => setSituacao("recebido")}
            />
            Já recebi
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="situacao"
              value="a_receber"
              checked={!recebido}
              onChange={() => setSituacao("a_receber")}
            />
            Ainda vou receber
          </label>
        </div>
      </fieldset>

      {recebido ? (
        <label className="flex flex-col gap-1 text-sm">
          Data do pagamento *
          <input
            name="data_pagamento"
            type="date"
            required
            defaultValue={pagamento?.data_pagamento ?? hoje}
            className="rounded-md border px-3 py-2"
          />
          <FieldError errors={fe.data_pagamento} />
        </label>
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          Vencimento *
          <input
            name="vencimento"
            type="date"
            required
            defaultValue={pagamento?.vencimento ?? dataRef}
            className="rounded-md border px-3 py-2"
          />
          <FieldError errors={fe.vencimento} />
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        {recebido ? "Forma de pagamento" : "Forma de pagamento prevista"}
        <input
          name="forma_pagamento"
          placeholder="Pix, dinheiro, cartão..."
          defaultValue={pagamento?.forma_pagamento ?? ""}
          className="rounded-md border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Observações
        <textarea
          name="observacoes"
          rows={2}
          defaultValue={pagamento?.observacoes ?? ""}
          className="rounded-md border px-3 py-2"
        />
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
