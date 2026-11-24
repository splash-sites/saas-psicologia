"use client";

import { useActionState } from "react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import { ErroCampo } from "@/components/ErroCampo";
import { useValidacao } from "@/lib/form/validacao";
import { LIMITES } from "@/lib/limites";
import { TIPOS_DOCUMENTO, type Documento } from "@/lib/documentos/tipos";
import { editarDocumento, type FormState } from "./actions";

const L = LIMITES.documento;

export function EditarDocumento({ doc }: { doc: Documento }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(editarDocumento.bind(null, doc.id), {});
  const fe = state.fieldErrors ?? {};
  const { erros, formProps } = useValidacao();

  return (
    <form {...formProps} onSubmit={enviarSemLimpar(formAction)} className="flex flex-col gap-3">
      {state.error && <p className="alert alert-error">{state.error}</p>}
      {state.ok && <p className="alert alert-success">Salvo.</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Nome *
          <input name="nome" required maxLength={L.nome} defaultValue={doc.nome} className="input" />
          <ErroCampo nome="nome" cliente={erros} servidor={fe.nome} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Data *
          <input name="data_documento" type="date" required defaultValue={doc.data_documento} className="input" />
          <ErroCampo nome="data_documento" cliente={erros} servidor={fe.data_documento} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm sm:w-72">
        Tipo *
        <select name="tipo" defaultValue={doc.tipo} className="input">
          {Object.entries(TIPOS_DOCUMENTO).map(([v, rotulo]) => (
            <option key={v} value={v}>
              {rotulo}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Finalidade
          <input name="finalidade" maxLength={L.finalidade} defaultValue={doc.finalidade ?? ""} className="input" />
          <ErroCampo nome="finalidade" cliente={erros} servidor={fe.finalidade} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Destinatário
          <input name="destinatario" maxLength={L.destinatario} defaultValue={doc.destinatario ?? ""} className="input" />
          <ErroCampo nome="destinatario" cliente={erros} servidor={fe.destinatario} />
        </label>
      </div>
      <button type="submit" disabled={pending} className="btn btn-primary btn-sm w-fit">
        {pending ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}
