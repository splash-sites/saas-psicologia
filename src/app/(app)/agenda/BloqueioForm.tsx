"use client";

import { useActionState, useState } from "react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import { useValidacao } from "@/lib/form/validacao";
import { ErroCampo } from "@/components/ErroCampo";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import type { FormState } from "./actions";
import { LIMITES } from "@/lib/limites";
import { RECORRENCIA_LABEL, RECORRENCIAS, type Recorrencia } from "@/lib/agenda/types";
import { MAX_DIAS_BLOQUEIO, SUGESTOES_MOTIVO_BLOQUEIO } from "@/lib/agenda/bloqueios";
import { addDias, hojeBR } from "@/lib/agenda/datas";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
};

export function BloqueioForm({ action }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};
  const { erros, formProps } = useValidacao();

  const [diaInteiro, setDiaInteiro] = useState(false);
  const [recorrencia, setRecorrencia] = useState<Recorrencia>("nenhuma");
  const [data, setData] = useState(hojeBR());
  // A lista de consultas some se a pessoa mexer no formulário (pode não valer mais).
  const [conflitosVistos, setConflitosVistos] = useState<FormState["conflitos"]>(undefined);
  const conflitos = state.conflitos && state.conflitos !== conflitosVistos ? state.conflitos : undefined;
  const limite = data ? addDias(data, MAX_DIAS_BLOQUEIO) : undefined;
  const recorrente = recorrencia !== "nenhuma";

  return (
    <form
      {...formProps}
      onInput={(e) => {
        if (state.conflitos) setConflitosVistos(state.conflitos);
        formProps.onInput(e);
      }}
      onSubmit={enviarSemLimpar(formAction)}
      className="flex flex-col gap-4"
    >
      {state.error && <p className="alert alert-error">{state.error}</p>}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="dia_inteiro"
          checked={diaInteiro}
          onChange={(e) => setDiaInteiro(e.target.checked)}
        />
        Dia inteiro
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          {diaInteiro && !recorrente ? "Primeiro dia *" : "Data *"}
          <input
            name="data"
            type="date"
            required
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="input"
          />
          <ErroCampo nome="data" cliente={erros} servidor={fe.data} />
        </label>
        {diaInteiro && !recorrente && (
          <label className="flex flex-col gap-1 text-sm">
            Último dia
            <input name="data_fim" type="date" min={data} max={limite} className="input" />
            <span className="text-xs text-slate-500">Para férias. Em branco: só um dia.</span>
            <ErroCampo nome="data_fim" cliente={erros} servidor={fe.data_fim} />
          </label>
        )}
      </div>

      {!diaInteiro && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Início *
            <input name="hora_inicio" type="time" required className="input" />
            <ErroCampo nome="hora_inicio" cliente={erros} servidor={fe.hora_inicio} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Fim *
            <input name="hora_fim" type="time" required className="input" />
            <ErroCampo nome="hora_fim" cliente={erros} servidor={fe.hora_fim} />
          </label>
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Motivo *
        <input
          name="motivo"
          list="sugestoes-motivo-bloqueio"
          maxLength={LIMITES.bloqueio.motivo}
          required
          data-obrigatorio="Informe o motivo do bloqueio."
          placeholder="Férias, compromisso pessoal, curso..."
          className="input"
        />
        <datalist id="sugestoes-motivo-bloqueio">
          {SUGESTOES_MOTIVO_BLOQUEIO.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <span className="text-xs text-slate-500">Aparece na agenda e no seu Google Agenda.</span>
        <ErroCampo nome="motivo" cliente={erros} servidor={fe.motivo} />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Repetir
          <select
            name="recorrencia"
            value={recorrencia}
            onChange={(e) => setRecorrencia(e.target.value as Recorrencia)}
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
            Até *
            <input name="repetir_ate" type="date" required min={data} max={limite} className="input" />
            <span className="text-xs text-slate-500">No máximo 1 ano à frente.</span>
            <ErroCampo nome="repetir_ate" cliente={erros} servidor={fe.repetir_ate} />
          </label>
        )}
      </div>

      {conflitos && conflitos.length > 0 && (
        <section className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="alert">
          <p className="flex items-center gap-2 font-medium">
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            {conflitos.length === 1 ? "Há 1 consulta nesse período:" : `Há ${conflitos.length} consultas nesse período:`}
          </p>
          <ul className="flex max-h-48 flex-col gap-0.5 overflow-y-auto pl-6">
            {conflitos.map((c) => (
              <li key={c.id}>
                {c.quando} · <span data-sensivel>{c.paciente}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-900">
            Ao bloquear, elas são canceladas. Quem é convidado pelo Google Agenda recebe o aviso de cancelamento.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" name="cancelar_consultas" value="on" disabled={pending} className="btn btn-primary btn-sm">
              {pending ? "Salvando..." : "Bloquear e cancelar essas consultas"}
            </button>
            <button type="button" onClick={() => setConflitosVistos(state.conflitos)} className="btn btn-outline btn-sm">
              Voltar
            </button>
          </div>
        </section>
      )}

      {!conflitos && (
        <div className="flex gap-3">
          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? "Salvando..." : "Bloquear"}
          </button>
          <Link href="/agenda/bloqueios" className="btn btn-outline">
            Cancelar
          </Link>
        </div>
      )}
    </form>
  );
}
