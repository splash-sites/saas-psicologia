"use client";

import { useActionState, useState } from "react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import { NOMES_DIA, ORDEM_DIAS, paraMinutos, type HorarioDia } from "@/lib/agenda/horarioAtendimento";
import type { FormState } from "./actions";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  horario: HorarioDia[];
};

/** Horário de atendimento (0044): liga/desliga e início/fim de cada dia. */
export function HorarioAtendimentoForm({ action, horario }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const [dias, setDias] = useState(horario);
  const fe = state.fieldErrors ?? {};

  const mudar = (dia: number, campo: Partial<HorarioDia>) =>
    setDias((atual) => atual.map((d) => (d.dia === dia ? { ...d, ...campo } : d)));

  return (
    <form onSubmit={enviarSemLimpar(formAction)} className="flex flex-col gap-3">
      {state.error && <p className="alert alert-error">{state.error}</p>}
      {state.ok && <p className="alert alert-success">Horário salvo.</p>}

      <ul className="flex flex-col divide-y divide-slate-100 rounded-lg border border-slate-200">
        {ORDEM_DIAS.map((n) => {
          const d = dias.find((x) => x.dia === n)!;
          const invertido = d.ativo && d.inicio && d.fim && paraMinutos(d.fim) <= paraMinutos(d.inicio);
          const erro = fe[`fim_${n}`]?.[0] ?? (invertido ? "O fim precisa ser depois do início." : null);
          return (
            <li key={n} className="flex flex-col gap-1 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <label className="flex min-w-32 items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    name={`ativo_${n}`}
                    checked={d.ativo}
                    onChange={(e) => mudar(n, { ativo: e.target.checked })}
                  />
                  {NOMES_DIA[n]}
                </label>
                {d.ativo ? (
                  <span className="flex items-center gap-2 text-sm">
                    <input
                      type="time"
                      name={`inicio_${n}`}
                      value={d.inicio}
                      onChange={(e) => mudar(n, { inicio: e.target.value })}
                      required
                      step={300}
                      aria-label={`Início de ${NOMES_DIA[n].toLowerCase()}`}
                      className="input w-32"
                    />
                    às
                    <input
                      type="time"
                      name={`fim_${n}`}
                      value={d.fim}
                      onChange={(e) => mudar(n, { fim: e.target.value })}
                      required
                      step={300}
                      aria-label={`Fim de ${NOMES_DIA[n].toLowerCase()}`}
                      aria-invalid={Boolean(erro) || undefined}
                      className="input w-32"
                    />
                  </span>
                ) : (
                  <>
                    <span className="text-sm text-slate-500">Não atende</span>
                    {/* Mantém o horário guardado para quando religar. */}
                    <input type="hidden" name={`inicio_${n}`} value={d.inicio} />
                    <input type="hidden" name={`fim_${n}`} value={d.fim} />
                  </>
                )}
              </div>
              {erro && <p className="text-xs text-red-700" role="alert">{erro}</p>}
            </li>
          );
        })}
      </ul>

      <button
        type="submit"
        disabled={pending || dias.some((d) => d.ativo && paraMinutos(d.fim) <= paraMinutos(d.inicio))}
        className="w-fit btn btn-primary"
      >
        {pending ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}
