"use client";

import { useActionState, useState } from "react";
import { ArrowRight, NotebookPen, Pencil } from "lucide-react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import { LIMITES } from "@/lib/limites";
import {
  levarAnotacaoParaProxima,
  salvarAnotacoesSessao,
  type AnotacoesState,
} from "./actions";

type Props = {
  consultaId: string;
  texto: string | null;
  /** Data da próxima sessão marcada, quando cabe "Levar para a próxima sessão". */
  levarPara?: string | null;
  /** Abre já no modo de escrever (vindo de "Anotar para a próxima sessão"). */
  abrirEditando?: boolean;
};

/**
 * "Anotações para a sessão" (0043): ideias e lembretes da psicóloga para uma
 * sessão. Editável sempre. Texto clínico: fica borrado no modo privado.
 */
export function AnotacoesSessao({ consultaId, texto, levarPara, abrirEditando }: Props) {
  const [state, formAction, pending] = useActionState<AnotacoesState, FormData>(
    salvarAnotacoesSessao.bind(null, consultaId),
    {},
  );
  const [levarState, levarAction, levando] = useActionState<AnotacoesState, FormData>(
    levarAnotacaoParaProxima.bind(null, consultaId),
    {},
  );
  const [editando, setEditando] = useState(Boolean(abrirEditando));
  // Salvou: volta para a leitura (ajuste de estado durante o render, sem efeito).
  const [salvoVisto, setSalvoVisto] = useState(state.salvoEm);
  if (state.salvoEm !== salvoVisto) {
    setSalvoVisto(state.salvoEm);
    setEditando(false);
  }

  return (
    <section className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:px-6" aria-labelledby={`anot-${consultaId}`}>
      <div className="flex items-center justify-between gap-2">
        <h3
          id={`anot-${consultaId}`}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          <NotebookPen className="size-3.5" aria-hidden />
          Anotações para a sessão
        </h3>
        {texto && !editando && (
          <button type="button" onClick={() => setEditando(true)} className="btn btn-outline btn-sm">
            <Pencil className="size-3.5" aria-hidden />
            Editar
          </button>
        )}
      </div>

      {editando ? (
        <form onSubmit={enviarSemLimpar(formAction)} className="flex flex-col gap-2">
          <textarea
            name="anotacoes_sessao"
            defaultValue={texto ?? ""}
            maxLength={LIMITES.consulta.anotacoes}
            rows={5}
            autoFocus
            aria-label="Anotações para a sessão"
            placeholder="Ideias para a sessão, temas para retomar, o que observar…"
            className="input"
          />
          {state.error && <p className="text-sm text-red-700" role="alert">{state.error}</p>}
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" onClick={() => setEditando(false)} className="btn btn-outline btn-sm">
              Cancelar
            </button>
          </div>
          <p className="text-xs text-slate-500">Fica no prontuário do paciente. Não vai para o Google Agenda.</p>
        </form>
      ) : texto ? (
        <p className="whitespace-pre-wrap text-sm text-slate-800" data-sensivel>
          {texto}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="w-fit text-sm font-medium text-teal-800 hover:opacity-80"
        >
          + Escrever anotações para esta sessão
        </button>
      )}

      {texto && !editando && levarPara && (
        <form onSubmit={enviarSemLimpar(levarAction)} className="flex flex-col gap-1">
          <button className="btn btn-outline btn-sm w-fit" disabled={levando}>
            <ArrowRight className="size-4" aria-hidden />
            Levar para a próxima sessão ({levarPara})
          </button>
          {levarState.error && <p className="text-sm text-red-700" role="alert">{levarState.error}</p>}
        </form>
      )}
    </section>
  );
}
