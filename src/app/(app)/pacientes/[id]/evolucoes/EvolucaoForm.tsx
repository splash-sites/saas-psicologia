"use client";

import { useActionState } from "react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import { useValidacao } from "@/lib/form/validacao";
import { ErroCampo } from "@/components/ErroCampo";
import Link from "next/link";
import { CAMPOS_EVOLUCAO, type Evolucao } from "@/lib/prontuario/types";
import { hojeBR } from "@/lib/agenda/datas";
import type { FormState } from "./actions";
import { LIMITES } from "@/lib/limites";

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

  return (
    <form {...formProps} onSubmit={enviarSemLimpar(formAction)} className="flex flex-col gap-5">
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

      {CAMPOS_EVOLUCAO.map((campo) => (
        <label key={campo.nome} className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{campo.rotulo} *</span>
          <span className="text-xs text-slate-500">{campo.ajuda}</span>
          <textarea
            name={campo.nome}
            maxLength={LIMITES.textoClinico}
            rows={4}
            required
            data-obrigatorio={`Preencha “${campo.rotulo}”.`}
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
          Opcional.
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
