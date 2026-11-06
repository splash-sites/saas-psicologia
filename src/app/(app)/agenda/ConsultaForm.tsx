"use client";

import { useActionState, useState } from "react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import { useValidacao } from "@/lib/form/validacao";
import { ErroCampo } from "@/components/ErroCampo";
import Link from "next/link";
import {
  MODALIDADES,
  MODALIDADE_LABEL,
  RECORRENCIAS,
  RECORRENCIA_LABEL,
} from "@/lib/agenda/types";
import { PacienteSelect } from "@/components/PacienteSelect";
import type { FormState } from "./actions";
import { LIMITES } from "@/lib/limites";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  pacientes: { id: string; nome: string }[];
  /** Vindos do clique num horário vazio da agenda. */
  dataPadrao?: string;
  horaPadrao?: string;
};


export function ConsultaForm({ action, pacientes, dataPadrao, horaPadrao }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  const [recorrente, setRecorrente] = useState(false);
  const fe = state.fieldErrors ?? {};
  const { erros, formProps } = useValidacao();

  return (
    <form {...formProps} onSubmit={enviarSemLimpar(formAction)} className="flex flex-col gap-4">
      {state.error && (
        <p className="alert alert-error">
          {state.error}
        </p>
      )}

      <div>
        <PacienteSelect pacientes={pacientes} />
        <ErroCampo nome="paciente_id" cliente={erros} servidor={fe.paciente_id} />
      </div>

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
          <ErroCampo nome="data" cliente={erros} servidor={fe.data} />
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
          <ErroCampo nome="hora" cliente={erros} servidor={fe.hora} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Duração (min) *
          <input
            name="duracao_min"
            type="number"
            defaultValue={50}
            min={LIMITES.consulta.duracaoMin}
            max={LIMITES.consulta.duracaoMax}
            step={5}
            data-faixa="A duração vai de 15 a 480 minutos (8 horas)."
            data-passo="Use múltiplos de 5 minutos (ex.: 45, 50, 60)."
            required
            data-obrigatorio="Informe a duração."
            className="input"
          />
          <ErroCampo nome="duracao_min" cliente={erros} servidor={fe.duracao_min} />
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
        <ErroCampo nome="modalidade" cliente={erros} servidor={fe.modalidade} />
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
              max={LIMITES.consulta.ocorrenciasMax}
              data-faixa="Escolha de 2 a 52 ocorrências (até 1 ano de consultas semanais)."
              className="input"
            />
            <ErroCampo nome="ocorrencias" cliente={erros} servidor={fe.ocorrencias} />
          </label>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Observações
        <textarea
          name="observacoes"
          maxLength={LIMITES.consulta.observacoes}
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
