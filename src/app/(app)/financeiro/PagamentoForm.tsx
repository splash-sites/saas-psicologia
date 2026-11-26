"use client";

import { useActionState, useState } from "react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import { useValidacao } from "@/lib/form/validacao";
import { ErroCampo } from "@/components/ErroCampo";
import Link from "next/link";
import type { Pagamento } from "@/lib/financeiro/types";
import { dataBR, hojeBR, horaBR } from "@/lib/agenda/datas";
import { PacienteSelect } from "@/components/PacienteSelect";
import type { FormState } from "./actions";
import { SelectFormaPagamento } from "./SelectFormaPagamento";
import { LIMITES } from "@/lib/limites";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  pacientes: { id: string; nome: string }[];
  /**
   * Sessão ligada a este lançamento (só leitura). O pagamento de uma sessão é
   * feito no painel da consulta (2026-11-26, decisão do usuário); aqui ela só
   * aparece quando o lançamento já é de uma sessão ou veio do painel.
   */
  consulta?: { id: string; inicio: string; pacienteNome: string } | null;
  pagamento?: Pagamento;
  pacienteIdPadrao?: string;
  dataPadrao?: string;
  /** Valor da consulta ou da sessão do paciente (0035). */
  valorPadrao?: number | null;
  submitLabel: string;
  cancelHref: string;
};


export function PagamentoForm({
  action,
  pacientes,
  consulta,
  pagamento,
  pacienteIdPadrao,
  dataPadrao,
  valorPadrao,
  submitLabel,
  cancelHref,
}: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  const fe = state.fieldErrors ?? {};
  const { erros, formProps } = useValidacao();
  const hoje = hojeBR();
  const dataRefInicial = pagamento?.data_referencia ?? dataPadrao ?? hoje;

  // Novo lançamento começa como "recebido" (caso mais comum: registrar um
  // pagamento que já caiu). Na edição, reflete o estado atual.
  const [situacao, setSituacao] = useState<"recebido" | "a_receber">(
    pagamento ? (pagamento.status === "pago" ? "recebido" : "a_receber") : "recebido",
  );
  const recebido = situacao === "recebido";

  const [pacienteId, setPacienteId] = useState(pagamento?.paciente_id ?? pacienteIdPadrao ?? "");
  const [dataRef, setDataRef] = useState(dataRefInicial);

  return (
    <form {...formProps} onSubmit={enviarSemLimpar(formAction)} className="flex flex-col gap-4">
      {state.error && (
        <p className="alert alert-error">
          {state.error}
        </p>
      )}

      {/* Mantém a ligação com a sessão (vazio = lançamento avulso). */}
      <input type="hidden" name="consulta_id" value={consulta?.id ?? ""} />
      {consulta && (
        <div className="flex flex-col gap-0.5 rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="text-xs text-slate-500">Sessão</span>
          <span>
            {dataBR(consulta.inicio)} às {horaBR(consulta.inicio)} · <span data-sensivel>{consulta.pacienteNome}</span>
          </span>
        </div>
      )}

      <div>
        <PacienteSelect pacientes={pacientes} value={pacienteId} onChange={setPacienteId} />
        <ErroCampo nome="paciente_id" cliente={erros} servidor={fe.paciente_id} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Valor (R$) *
          <input
            name="valor"
            max={LIMITES.pagamento.valorMax}
            data-obrigatorio="Informe o valor."
            type="number"
            step="0.01"
            min="0.01"
            data-faixa="O valor mínimo é R$ 0,01."
            data-passo="Use no máximo 2 casas decimais (ex.: 150,50)."
            required
            defaultValue={pagamento?.valor ?? valorPadrao ?? ""}
            className="input"
          />
          <ErroCampo nome="valor" cliente={erros} servidor={fe.valor} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Referente a (sessão/mês) *
          <input
            name="data_referencia"
            type="date"
            required
            value={dataRef}
            onChange={(e) => setDataRef(e.target.value)}
            className="input"
          />
          <ErroCampo nome="data_referencia" cliente={erros} servidor={fe.data_referencia} />
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
            className="input"
          />
          <ErroCampo nome="data_pagamento" cliente={erros} servidor={fe.data_pagamento} />
        </label>
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          Vencimento *
          <input
            name="vencimento"
            type="date"
            required
            defaultValue={pagamento?.vencimento ?? dataRef}
            className="input"
          />
          <ErroCampo nome="vencimento" cliente={erros} servidor={fe.vencimento} />
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        {recebido ? "Forma de pagamento" : "Forma de pagamento prevista"}
        <SelectFormaPagamento defaultValue={pagamento?.forma_pagamento} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Observações
        <textarea
          name="observacoes"
          maxLength={LIMITES.pagamento.observacoes}
          rows={2}
          defaultValue={pagamento?.observacoes ?? ""}
          className="input"
        />
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
