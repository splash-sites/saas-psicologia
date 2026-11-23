"use client";

import { useActionState, useState } from "react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import { useValidacao } from "@/lib/form/validacao";
import { ErroCampo } from "@/components/ErroCampo";
import { hojeBR } from "@/lib/agenda/datas";
import { formatarBRL } from "@/lib/financeiro/types";
import { SelectFormaPagamento } from "../../SelectFormaPagamento";
import type { FormState } from "../../actions";

export type LinhaAberta = {
  id: string;
  valor: number;
  dataReferencia: string;
  vencimento: string;
  atrasado: boolean;
  /** Criado sozinho pela sessão (0035) ou lançado à mão. */
  sessao: boolean;
};

function dataBR(iso: string): string {
  return iso.split("-").reverse().join("/");
}

export function BaixaEmLoteForm({
  action,
  linhas,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  linhas: LinhaAberta[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const { erros, formProps } = useValidacao();
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(linhas.map((l) => l.id)));
  const total = linhas.filter((l) => marcados.has(l.id)).reduce((s, l) => s + l.valor, 0);

  function alternar(id: string) {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  return (
    <form {...formProps} onSubmit={enviarSemLimpar(formAction)} className="flex flex-col gap-4">
      {state.error && <p className="alert alert-error">{state.error}</p>}

      <div className="rounded-lg border bg-white">
        <label className="flex items-center gap-3 border-b px-4 py-2 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={marcados.size === linhas.length}
            onChange={(e) => setMarcados(e.target.checked ? new Set(linhas.map((l) => l.id)) : new Set())}
          />
          Todos
        </label>
        <ul className="divide-y text-sm">
          {linhas.map((l) => (
            <li key={l.id}>
              <label className="flex items-center gap-3 px-4 py-3">
                <input type="checkbox" name="ids" value={l.id} checked={marcados.has(l.id)} onChange={() => alternar(l.id)} />
                <span className="flex flex-1 flex-col">
                  <span>
                    {l.sessao ? "Sessão de " : "Lançamento de "}
                    {dataBR(l.dataReferencia)}
                  </span>
                  <span className={`text-xs ${l.atrasado ? "text-red-700" : "text-slate-500"}`}>
                    {l.atrasado ? "Atrasado · venceu em " : "Vence em "}
                    {dataBR(l.vencimento)}
                  </span>
                </span>
                <span className="font-medium" data-sensivel>
                  {formatarBRL(l.valor)}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs">
          Data do pagamento
          <input name="data_pagamento" type="date" required defaultValue={hojeBR()} className="input w-auto" />
          <ErroCampo nome="data_pagamento" cliente={erros} servidor={state.fieldErrors?.data_pagamento} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Forma
          <SelectFormaPagamento className="input w-auto" />
        </label>
        <button type="submit" disabled={pending || marcados.size === 0} className="btn btn-success">
          {pending
            ? "Salvando..."
            : `Dar baixa em ${marcados.size} · ${formatarBRL(total)}`}
        </button>
      </div>
    </form>
  );
}
