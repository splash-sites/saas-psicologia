"use client";

import { useActionState } from "react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import type { FormState } from "./actions";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  valorAtual: string | null;
};

export function LinkAtendimentoForm({ action, valorAtual }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form onSubmit={enviarSemLimpar(formAction)} className="flex flex-col gap-3">
      {state.error && <p className="alert alert-error">{state.error}</p>}
      {state.ok && <p className="alert alert-success">Link salvo.</p>}

      <label className="flex flex-col gap-1 text-sm">
        Link da sua sala de atendimento online
        <input
          name="link_atendimento_online"
          type="url"
          inputMode="url"
          defaultValue={valorAtual ?? ""}
          placeholder="https://meet.google.com/abc-defg-hij"
          className="input"
        />
        <span className="text-xs text-slate-500">
          Pode ser do Google Meet, Zoom ou outra plataforma. Ele aparece nas
          consultas online e entra no lembrete do WhatsApp. No Google Meet,
          &ldquo;Criar uma reunião para depois&rdquo; gera um link que não
          muda. Deixe em branco para remover.
        </span>
        {fe.link_atendimento_online && (
          <span className="text-xs text-red-600">{fe.link_atendimento_online[0]}</span>
        )}
      </label>

      <button type="submit" disabled={pending} className="w-fit btn btn-primary">
        {pending ? "Salvando..." : "Salvar link"}
      </button>
    </form>
  );
}
