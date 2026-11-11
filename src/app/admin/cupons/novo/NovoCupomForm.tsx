"use client";

import { useActionState } from "react";
import Link from "next/link";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import { useValidacao } from "@/lib/form/validacao";
import { ErroCampo } from "@/components/ErroCampo";
import { criarCupom, type FormState } from "../actions";

export function NovoCupomForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(criarCupom, {});
  const { erros, formProps } = useValidacao();
  const fe = state.fieldErrors ?? {};

  return (
    <form {...formProps} onSubmit={enviarSemLimpar(formAction)} className="card flex flex-col gap-4 sm:p-6">
      {state.error && <p className="alert alert-error">{state.error}</p>}

      <label className="flex flex-col gap-1 text-sm">
        Código *
        <input
          name="codigo"
          required
          minLength={3}
          maxLength={30}
          pattern="[A-Za-z0-9][A-Za-z0-9_\-]{2,29}"
          title="De 3 a 30 letras, números, hífen ou sublinhado."
          data-obrigatorio="Informe o código."
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="Ex.: PSICO30"
          className="input uppercase"
        />
        <span className="text-xs text-slate-500">
          É o que a psicóloga digita, e o que vai no link: app.gradatim.com.br/cadastro?cupom=CÓDIGO
        </span>
        <ErroCampo nome="codigo" cliente={erros} servidor={fe.codigo} />
      </label>

      <label className="flex flex-col gap-1 text-sm sm:max-w-xs">
        Dias grátis *
        <input
          name="dias"
          type="number"
          required
          min={1}
          max={365}
          step={1}
          defaultValue={30}
          data-obrigatorio="Informe quantos dias grátis."
          data-faixa="De 1 a 365 dias."
          className="input"
        />
        <ErroCampo nome="dias" cliente={erros} servidor={fe.dias} />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Válido até
          <input name="valido_ate" type="date" className="input" />
          <span className="text-xs text-slate-500">Em branco: sem validade.</span>
          <ErroCampo nome="valido_ate" cliente={erros} servidor={fe.valido_ate} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Limite de usos
          <input
            name="limite_usos"
            type="number"
            min={1}
            step={1}
            data-faixa="O limite é de pelo menos 1 uso."
            placeholder="Sem limite"
            className="input"
          />
          <span className="text-xs text-slate-500">Em branco: quantas contas quiserem.</span>
          <ErroCampo nome="limite_usos" cliente={erros} servidor={fe.limite_usos} />
        </label>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Criando..." : "Criar cupom"}
        </button>
        <Link href="/admin/cupons" className="btn btn-outline">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
