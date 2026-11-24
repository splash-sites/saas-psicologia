"use client";

import { useActionState, useState } from "react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import { useValidacao } from "@/lib/form/validacao";
import { ErroCampo } from "@/components/ErroCampo";
import { LIMITES } from "@/lib/limites";
import { MENSAGEM_ANIVERSARIO_PADRAO, mensagemAniversario } from "@/lib/aniversario";
import type { FormState } from "./actions";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  mensagem: string | null;
};

export function AniversarioForm({ action, mensagem }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const [texto, setTexto] = useState(mensagem ?? "");
  const fe = state.fieldErrors ?? {};
  const { erros, formProps } = useValidacao();

  return (
    <form {...formProps} onSubmit={enviarSemLimpar(formAction)} className="flex flex-col gap-3">
      {state.error && <p className="alert alert-error">{state.error}</p>}
      {state.ok && <p className="alert alert-success">Mensagem salva.</p>}

      <label className="flex flex-col gap-1 text-sm">
        Mensagem de parabéns
        <textarea
          name="mensagem_aniversario"
          rows={3}
          maxLength={LIMITES.aniversario.mensagem}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={MENSAGEM_ANIVERSARIO_PADRAO}
          className="input"
        />
        <span className="text-xs text-slate-500">
          Use {"{nome}"} para o primeiro nome do paciente. Em branco, vale o texto
          sugerido. Dá para mudar no WhatsApp antes de enviar.
        </span>
        <ErroCampo nome="mensagem_aniversario" cliente={erros} servidor={fe.mensagem_aniversario} />
      </label>

      <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <span className="text-xs font-medium text-slate-500">Prévia: </span>
        {mensagemAniversario(texto, "Maria Silva")}
      </p>

      <button type="submit" disabled={pending} className="w-fit btn btn-primary">
        {pending ? "Salvando..." : "Salvar mensagem"}
      </button>
    </form>
  );
}
