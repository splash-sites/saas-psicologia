"use client";

import { useActionState, useState } from "react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import { useValidacao } from "@/lib/form/validacao";
import { ErroCampo } from "@/components/ErroCampo";
import type { FormState } from "../actions";
import { LIMITES } from "@/lib/limites";

export function ArquivarForm({
  action,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [aberto, setAberto] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  const { erros, formProps } = useValidacao();

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="text-sm text-red-600 hover:opacity-80"
      >
        Arquivar evolução
      </button>
    );
  }

  return (
    <form {...formProps} onSubmit={enviarSemLimpar(formAction)} className="flex flex-col gap-2">
      <p className="text-sm text-slate-600">
        A evolução deixa de aparecer na timeline ativa, mas continua guardada
        (exigência de guarda mínima de 5 anos). Informe o motivo:
      </p>
      {state.error && (
        <p className="text-sm text-red-700">{state.error}</p>
      )}
      <input
        name="motivo"
        maxLength={LIMITES.evolucao.motivoArquivamento}
        required
        minLength={3}
        placeholder="Ex.: registro duplicado, erro de digitação corrigido em nova evolução"
        data-obrigatorio="Informe o motivo do arquivamento."
        className="input"
      />
      <ErroCampo nome="motivo" cliente={erros} servidor={state.fieldErrors?.motivo} />
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-danger"
        >
          {pending ? "Arquivando..." : "Confirmar arquivamento"}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="btn btn-outline"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
