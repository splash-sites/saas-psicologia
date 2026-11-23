"use client";

import { useActionState, useCallback, useRef } from "react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import { EVENTO_CAMPO_VALIDO, useValidacao } from "@/lib/form/validacao";
import { MSG_EVOLUCAO_VAZIA } from "@/lib/prontuario/schema";
import { ErroCampo } from "@/components/ErroCampo";
import Link from "next/link";
import { CAMPOS_EVOLUCAO, type Evolucao } from "@/lib/prontuario/types";
import { hojeBR } from "@/lib/agenda/datas";
import type { FormState } from "./actions";
import { LIMITES } from "@/lib/limites";

const NOMES_TEXTO = [...CAMPOS_EVOLUCAO.map((c) => c.nome), "notas_privadas"];

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  evolucao?: Evolucao;
  consultaId?: string;
  dataSessaoPadrao?: string;
  submitLabel: string;
  cancelHref: string;
};


export function EvolucaoForm({
  action,
  evolucao,
  consultaId,
  dataSessaoPadrao,
  submitLabel,
  cancelHref,
}: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  const fe = state.fieldErrors ?? {};
  const { erros, formProps } = useValidacao();

  // Pelo menos um campo preenchido (notas privadas contam). A regra vira a
  // validação nativa do 1º campo, então o erro aparece embaixo dele e some ao
  // digitar em qualquer campo — como os outros erros do app.
  const formRef = useRef<HTMLFormElement | null>(null);
  const conferirAlgumCampo = useCallback((form: HTMLFormElement | null) => {
    if (!form) return;
    const textos = NOMES_TEXTO.map((n) => form.elements.namedItem(n) as HTMLTextAreaElement | null);
    const algum = textos.some((t) => t && t.value.trim() !== "");
    const primeiro = textos[0];
    if (!primeiro) return;
    primeiro.setCustomValidity(algum ? "" : MSG_EVOLUCAO_VAZIA);
    if (algum) primeiro.dispatchEvent(new Event(EVENTO_CAMPO_VALIDO, { bubbles: true }));
  }, []);
  const refValidacao = formProps.ref;
  const ref = useCallback(
    (form: HTMLFormElement | null) => {
      formRef.current = form;
      conferirAlgumCampo(form);
      return refValidacao(form);
    },
    [refValidacao, conferirAlgumCampo],
  );

  return (
    <form
      {...formProps}
      ref={ref}
      onInput={(e) => {
        conferirAlgumCampo(formRef.current);
        formProps.onInput(e);
      }}
      onSubmit={enviarSemLimpar(formAction)}
      className="flex flex-col gap-5"
    >
      {state.error && (
        <p className="alert alert-error">
          {state.error}
        </p>
      )}

      {(evolucao?.consulta_id ?? consultaId) && (
        <input
          type="hidden"
          name="consulta_id"
          value={evolucao?.consulta_id ?? consultaId}
        />
      )}

      <label className="flex w-fit flex-col gap-1 text-sm">
        Data da sessão *
        <input
          name="data_sessao"
          type="date"
          required
          defaultValue={
            evolucao?.data_sessao ??
            dataSessaoPadrao ??
            hojeBR()
          }
          className="input"
        />
        <ErroCampo nome="data_sessao" cliente={erros} servidor={fe.data_sessao} />
      </label>

      <p className="-mb-2 text-sm text-slate-600">
        Preencha os campos que fizerem sentido para esta sessão.
      </p>

      {CAMPOS_EVOLUCAO.map((campo) => (
        <label key={campo.nome} className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{campo.rotulo}</span>
          <span className="text-xs text-slate-500">{campo.ajuda}</span>
          <textarea
            name={campo.nome}
            maxLength={LIMITES.textoClinico}
            rows={4}
            defaultValue={evolucao?.[campo.nome] ?? ""}
            className="input mt-1"
          />
          <ErroCampo nome={campo.nome} cliente={erros} servidor={fe[campo.nome]} />
        </label>
      ))}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Notas técnicas privadas</span>
        <span className="text-xs text-slate-500">
          Anotações de uso exclusivo do psicólogo, separadas da evolução.
        </span>
        <textarea
          name="notas_privadas"
          maxLength={LIMITES.textoClinico}
          rows={3}
          defaultValue={evolucao?.notas_privadas ?? ""}
          className="input mt-1"
        />
        <ErroCampo nome="notas_privadas" cliente={erros} servidor={fe.notas_privadas} />
      </label>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary"
        >
          {pending ? "Salvando..." : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="btn btn-outline"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
