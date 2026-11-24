"use client";

import { useActionState } from "react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import { UFS } from "@/lib/feriados";
import type { FormState } from "./actions";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  uf: string | null;
  mostrar: boolean;
};

export function FeriadosForm({ action, uf, mostrar }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});

  return (
    <form onSubmit={enviarSemLimpar(formAction)} className="flex flex-col gap-3">
      {state.error && <p className="alert alert-error">{state.error}</p>}
      {state.ok && <p className="alert alert-success">Preferência salva.</p>}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="mostrar_feriados" defaultChecked={mostrar} />
        Mostrar feriados no calendário
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Estado
        <select name="feriados_uf" defaultValue={uf ?? ""} className="input sm:w-72">
          <option value="">Só feriados nacionais</option>
          {Object.entries(UFS).map(([sigla, nome]) => (
            <option key={sigla} value={sigla}>
              {nome}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">
          Com o estado, a agenda mostra também os feriados estaduais. Feriados
          municipais não aparecem.
        </span>
      </label>

      <button type="submit" disabled={pending} className="w-fit btn btn-primary">
        {pending ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}
