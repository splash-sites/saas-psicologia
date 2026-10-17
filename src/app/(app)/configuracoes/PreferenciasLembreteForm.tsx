"use client";

import { useActionState, useState } from "react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import {
  TEMPLATE_PADRAO,
  VARIAVEIS_TEMPLATE,
  renderizarLembrete,
} from "@/lib/lembretes/template";
import type { FormState } from "./actions";
import { useLinkAtendimento } from "./LinkAtendimentoContext";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: {
    antecedencia_horas: number;
    mensagem_template: string | null;
    convite_google: boolean;
  };
  /** Falso com a integração do Google desligada: o convite não existe. */
  mostrarConviteGoogle: boolean;
  /** Agenda conectada: cada consulta online tem o próprio link do Meet. */
  meetAutomatico: boolean;
};

export function PreferenciasLembreteForm({
  action,
  defaults,
  mostrarConviteGoogle,
  meetAutomatico,
}: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  const [template, setTemplate] = useState(defaults.mensagem_template ?? "");
  const fe = state.fieldErrors ?? {};

  // Com a Agenda conectada, a prévia mostra um exemplo de link do Meet (cada
  // consulta ganha o seu). Sem ela, usa o link digitado em "Atendimento
  // online", mesmo antes de salvar.
  const linkDigitado = useLinkAtendimento()?.link.trim() ?? "";
  const linkPrevia = meetAutomatico
    ? "https://meet.google.com/abc-defg-hij"
    : linkDigitado || null;

  const exemplo = renderizarLembrete(template, {
    nome: "Maria Souza",
    data: "15/09",
    hora: "14:00",
    modalidade: "online",
    link: linkPrevia,
  });

  return (
    <form onSubmit={enviarSemLimpar(formAction)} className="flex flex-col gap-4">
      {state.error && (
        <p className="alert alert-error">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="alert alert-success">
          Preferências salvas.
        </p>
      )}

      <label className="flex w-fit flex-col gap-1 text-sm">
        Lembrar com antecedência de (horas)
        <input
          name="antecedencia_horas"
          type="number"
          min={1}
          max={168}
          defaultValue={defaults.antecedencia_horas}
          className="input w-28"
        />
        <span className="text-xs text-slate-500">
          Define para qual dia a lista de Lembretes abre por padrão (24h = amanhã).
        </span>
        {fe.antecedencia_horas && (
          <span className="text-xs text-red-600">{fe.antecedencia_horas[0]}</span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Mensagem do lembrete no WhatsApp
        <textarea
          name="mensagem_template"
          rows={4}
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          placeholder={TEMPLATE_PADRAO}
          className="input"
        />
        <span className="text-xs text-slate-500">
          Deixe em branco para usar o texto padrão. Variáveis:{" "}
          {VARIAVEIS_TEMPLATE.map((v) => v.nome).join(" ")}. Não coloque
          informação clínica na mensagem.
        </span>
        {fe.mensagem_template && (
          <span className="text-xs text-red-600">{fe.mensagem_template[0]}</span>
        )}
      </label>

      <div className="rounded-md bg-slate-50 p-3 text-sm">
        <div className="mb-1 text-xs text-slate-500">
          Prévia (consulta online{meetAutomatico ? "; o link do Meet muda a cada consulta" : ""})
        </div>
        <p className="whitespace-pre-wrap">{exemplo}</p>
        {!linkPrevia && (
          <p className="mt-2 text-xs text-amber-700">
            Sem link de atendimento online cadastrado: o lembrete de consultas
            online sai sem link.
          </p>
        )}
      </div>

      {mostrarConviteGoogle ? (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="convite_google"
            defaultChecked={defaults.convite_google}
            className="mt-1"
          />
          <span>
            Convidar o paciente pelo Google Agenda
            <span className="block text-xs text-slate-500">
              O paciente recebe um convite por e-mail (com o link do Meet nas
              consultas online) e é avisado se você remarcar ou cancelar. Só vale
              para pacientes que aceitam lembretes e têm e-mail cadastrado.
            </span>
          </span>
        </label>
      ) : (
        // Integração desligada: preserva a escolha salva para quando religar.
        defaults.convite_google && <input type="hidden" name="convite_google" value="on" />
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-fit btn btn-primary"
      >
        {pending ? "Salvando..." : "Salvar preferências"}
      </button>
    </form>
  );
}
