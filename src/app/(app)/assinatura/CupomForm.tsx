"use client";

import { useActionState, useState } from "react";
import { Loader2, Ticket } from "lucide-react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import { useValidacao } from "@/lib/form/validacao";
import { ErroCampo } from "@/components/ErroCampo";
import { usarCupom, type CupomState } from "./actions";

// "Tenho um cupom": fechado por padrão (quem não tem cupom não precisa ver o
// campo). Só aparece para quem ainda não assinou e não usou cupom.
export function CupomForm() {
  const [aberto, setAberto] = useState(false);
  const [state, formAction, pending] = useActionState<CupomState, FormData>(usarCupom, {});
  const { erros, formProps } = useValidacao();

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-2 self-start text-sm font-medium text-teal-800 hover:text-teal-900"
      >
        <Ticket className="size-4" aria-hidden />
        Tenho um cupom
      </button>
    );
  }

  return (
    <form {...formProps} onSubmit={enviarSemLimpar(formAction)} className="card flex flex-col gap-3 sm:p-6">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Código do cupom
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            name="cupom"
            required
            minLength={3}
            maxLength={30}
            pattern="[A-Za-z0-9][A-Za-z0-9_\-]{2,29}"
            title="Só letras, números, hífen e sublinhado."
            data-obrigatorio="Digite o código do cupom."
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="Ex.: PSICO30"
            className="input uppercase sm:flex-1"
          />
          <button type="submit" disabled={pending} aria-busy={pending} className="btn btn-primary">
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {pending ? "Aplicando..." : "Aplicar"}
          </button>
        </div>
        <ErroCampo nome="cupom" cliente={erros} />
      </label>
      {state.texto && (
        <p className={`alert ${state.tipo === "sucesso" ? "alert-success" : "alert-error"}`} role="status">
          {state.texto}
        </p>
      )}
    </form>
  );
}
