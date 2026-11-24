"use client";

import { useActionState, useRef, useState } from "react";
import { CampoValorConsulta } from "./CampoValorConsulta";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import { useValidacao } from "@/lib/form/validacao";
import { ErroCampo } from "@/components/ErroCampo";
import Link from "next/link";
import {
  MODALIDADES,
  MODALIDADE_LABEL,
  CONSULTA_STATUS,
  CONSULTA_STATUS_LABEL,
} from "@/lib/agenda/types";
import type { FormState } from "./actions";
import { LIMITES } from "@/lib/limites";
import { avisoFeriados, feriadosDasSessoes, type PreferenciaFeriados } from "@/lib/feriados";
import { AvisoFeriado } from "./AvisoFeriado";
import { PreviaSemana } from "./PreviaSemana";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: {
    data: string;
    hora: string;
    duracao_min: number;
    modalidade: string;
    status: string;
    observacoes: string | null;
    valor: number | null;
    cobrar: boolean;
  };
  cancelHref: string;
  /** A própria consulta não aparece como ocupada na prévia da semana. */
  consultaId?: string;
  /** Estado e "mostrar feriados" da psicóloga (0038). */
  feriados?: PreferenciaFeriados;
};


export function ConsultaEdicaoForm({ action, defaults, cancelHref, consultaId, feriados }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  const fe = state.fieldErrors ?? {};
  const { erros, formProps } = useValidacao();
  const [valor, setValor] = useState(defaults.valor != null ? String(defaults.valor) : "");
  const [status, setStatus] = useState(defaults.status);
  const [data, setData] = useState(defaults.data);
  const [hora, setHora] = useState(defaults.hora);
  const dataRef = useRef<HTMLInputElement>(null);
  const horaRef = useRef<HTMLInputElement>(null);
  const aviso = status === "agendada" ? avisoFeriados(feriadosDasSessoes(data ? [data] : [], feriados), 1) : null;

  return (
    <form {...formProps} onSubmit={enviarSemLimpar(formAction)} className="flex flex-col gap-4">
      {state.error && (
        <p className="alert alert-error">
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          Data
          <input
            ref={dataRef}
            name="data"
            type="date"
            defaultValue={defaults.data}
            onChange={(e) => setData(e.target.value)}
            required
            className="input"
          />
          <ErroCampo nome="data" cliente={erros} servidor={fe.data} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Hora
          <input
            ref={horaRef}
            name="hora"
            type="time"
            defaultValue={defaults.hora}
            onChange={(e) => setHora(e.target.value)}
            required
            className="input"
          />
          <ErroCampo nome="hora" cliente={erros} servidor={fe.hora} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Duração (min)
          <input
            name="duracao_min"
            data-obrigatorio="Informe a duração."
            type="number"
            defaultValue={defaults.duracao_min}
            min={LIMITES.consulta.duracaoMin}
            max={LIMITES.consulta.duracaoMax}
            step={5}
            data-faixa="A duração vai de 15 a 480 minutos (8 horas)."
            data-passo="Use múltiplos de 5 minutos (ex.: 45, 50, 60)."
            required
            className="input"
          />
          <ErroCampo nome="duracao_min" cliente={erros} servidor={fe.duracao_min} />
        </label>
      </div>

      <PreviaSemana
        data={data}
        hora={hora}
        ignorarConsultaId={consultaId}
        abertoInicial={false}
        onEscolher={(d, h) => {
          if (dataRef.current) dataRef.current.value = d;
          if (horaRef.current) horaRef.current.value = h;
          setData(d);
          setHora(h);
          horaRef.current?.focus();
        }}
      />

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
            value={status}
            onChange={(e) => setStatus(e.target.value)}
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoValorConsulta valor={valor} onChange={setValor} erros={erros} servidor={fe.valor} />
        {status === "falta" && valor !== "" && (
          <label className="flex items-center gap-2 self-center text-sm">
            <input type="checkbox" name="cobrar" defaultChecked={defaults.status === "falta" && defaults.cobrar} />
            Cobrar esta falta
          </label>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Observações
        <textarea
          name="observacoes"
          maxLength={LIMITES.consulta.observacoes}
          rows={2}
          defaultValue={defaults.observacoes ?? ""}
          className="input"
        />
      </label>

      <AvisoFeriado texto={aviso} />

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
