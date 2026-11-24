"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import type { Anamnese } from "@/lib/pacientes/types";
import type { FormState } from "../actions";
import { LIMITES } from "@/lib/limites";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  anamnese?: Anamnese | null;
};

const CAMPOS = [
  { nome: "demanda", rotulo: "Demanda / queixa inicial", linhas: 3 },
  { nome: "objetivos", rotulo: "Objetivos do trabalho", linhas: 3 },
  { nome: "historico", rotulo: "Histórico relevante", linhas: 4 },
] as const;

// Anamnese na ficha (2026-11-24, decisão do usuário): em leitura mostra só os
// campos preenchidos; "Editar" (ou "Preencher anamnese", se vazia) abre os
// campos. Salvou com sucesso, volta para a leitura.
export function AnamneseForm({ action, anamnese }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  // Estado do formulário quando abriu a edição; null = em leitura.
  const [abertoEm, setAbertoEm] = useState<FormState | null>(null);
  const editando = abertoEm !== null && !(state.ok && state !== abertoEm);
  const preenchidos = CAMPOS.filter((c) => anamnese?.[c.nome]?.trim());

  if (!editando) {
    return (
      <div className="flex flex-col gap-3">
        {state.ok && abertoEm !== null && <p className="alert alert-success">Anamnese salva.</p>}
        {preenchidos.length === 0 ? (
          <button type="button" onClick={() => setAbertoEm(state)} className="btn btn-outline btn-sm w-fit">
            <Plus className="size-4" aria-hidden />
            Preencher anamnese
          </button>
        ) : (
          <>
            <div className="card flex flex-col gap-3 text-sm">
              {preenchidos.map((c) => (
                <div key={c.nome} className="flex flex-col gap-0.5">
                  <span className="text-xs text-slate-500">{c.rotulo}</span>
                  <p className="whitespace-pre-wrap text-slate-800">{anamnese?.[c.nome]}</p>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setAbertoEm(state)} className="btn btn-outline btn-sm w-fit">
              <Pencil className="size-4" aria-hidden />
              Editar anamnese
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={enviarSemLimpar(formAction)} className="flex flex-col gap-4">
      {state.error && <p className="alert alert-error">{state.error}</p>}

      {CAMPOS.map((c) => (
        <label key={c.nome} className="flex flex-col gap-1 text-sm">
          {c.rotulo}
          <textarea
            name={c.nome}
            maxLength={LIMITES.textoClinico}
            rows={c.linhas}
            defaultValue={anamnese?.[c.nome] ?? ""}
            className="input"
          />
        </label>
      ))}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Salvando..." : "Salvar anamnese"}
        </button>
        <button type="button" disabled={pending} onClick={() => setAbertoEm(null)} className="btn btn-outline">
          Cancelar
        </button>
      </div>
    </form>
  );
}
