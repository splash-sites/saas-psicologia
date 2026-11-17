"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import { useValidacao } from "@/lib/form/validacao";
import { ErroCampo } from "@/components/ErroCampo";
import { ASSINATURA_PLANO, PLANOS } from "@/lib/assinatura/types";
import {
  cobrancaMinima,
  descricaoDesconto,
  resumoComCupom,
  VALOR_MINIMO_COBRANCA,
  type Desconto,
} from "@/lib/assinatura/desconto";
import { criarCupom, type FormState } from "../actions";

type Tipo = "dias" | "desconto";

function brl(v: number): string {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

export function NovoCupomForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(criarCupom, {});
  const { erros, formProps } = useValidacao();
  const fe = state.fieldErrors ?? {};

  const [tipo, setTipo] = useState<Tipo>("dias");
  const [descontoTipo, setDescontoTipo] = useState<Desconto["tipo"]>("percentual");
  const [valor, setValor] = useState("10");
  const [duracao, setDuracao] = useState<"meses" | "sempre">("meses");
  const [meses, setMeses] = useState("1");

  // Prévia: o que cada plano cobraria com o cupom.
  const valorNum = Number(valor.replace(",", "."));
  const mesesNum = Number(meses);
  const previa: Desconto | null =
    tipo === "desconto" && valorNum > 0 && (duracao === "sempre" || (Number.isInteger(mesesNum) && mesesNum >= 1))
      ? { tipo: descontoTipo, valor: valorNum, meses: duracao === "sempre" ? null : mesesNum }
      : null;
  const minima = previa ? cobrancaMinima(previa) : null;

  return (
    <form {...formProps} onSubmit={enviarSemLimpar(formAction)} className="card flex flex-col gap-5 sm:p-6">
      {state.error && <p className="alert alert-error">{state.error}</p>}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Tipo de cupom *</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(
            [
              ["dias", "Dias grátis", "Estende o teste de quem ainda não assinou."],
              ["desconto", "Desconto na assinatura", "Valor menor nas primeiras cobranças, ou para sempre."],
            ] as const
          ).map(([id, titulo, texto]) => (
            <label
              key={id}
              className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border-2 p-3 text-sm ${
                tipo === id ? "border-teal-700 bg-teal-50/60" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <span className="flex items-center gap-2 font-semibold">
                <input
                  type="radio"
                  name="tipo"
                  value={id}
                  checked={tipo === id}
                  onChange={() => setTipo(id)}
                  className="size-4 accent-teal-700"
                />
                {titulo}
              </span>
              <span className="text-slate-600">{texto}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        Código *
        <input
          name="codigo"
          required
          minLength={3}
          maxLength={30}
          pattern="[A-Za-z0-9][A-Za-z0-9_\-]{2,29}"
          title="De 3 a 30 letras, números, hífen e sublinhado."
          data-obrigatorio="Informe o código."
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={tipo === "dias" ? "Ex.: PSICO30" : "Ex.: BLACK10"}
          className="input uppercase"
        />
        <span className="text-xs text-slate-500">
          É o que a psicóloga digita, e o que vai no link: app.gradatim.com.br/cadastro?cupom=CÓDIGO
        </span>
        <ErroCampo nome="codigo" cliente={erros} servidor={fe.codigo} />
      </label>

      {tipo === "dias" ? (
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
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Desconto *
              <span className="flex gap-2">
                <select
                  name="desconto_tipo"
                  value={descontoTipo}
                  onChange={(e) => setDescontoTipo(e.target.value as Desconto["tipo"])}
                  className="input w-auto"
                  aria-label="Tipo de desconto"
                >
                  <option value="percentual">%</option>
                  <option value="valor">R$ por mês</option>
                </select>
                <input
                  name="desconto_valor"
                  required
                  inputMode="decimal"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  data-obrigatorio="Informe o desconto."
                  className="input flex-1"
                  aria-label={descontoTipo === "percentual" ? "Percentual de desconto" : "Reais a menos por mês"}
                />
              </span>
              <span className="text-xs text-slate-500">
                {descontoTipo === "percentual" ? "Ex.: 20 = 20% em cada mês com desconto." : "Ex.: 10 = R$ 10,00 a menos em cada mês com desconto."}
              </span>
              <ErroCampo nome="desconto_valor" cliente={erros} servidor={fe.desconto_valor} />
            </label>

            <fieldset className="flex flex-col gap-1 text-sm">
              <legend className="mb-1">Por quanto tempo *</legend>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="desconto_duracao"
                  value="meses"
                  checked={duracao === "meses"}
                  onChange={() => setDuracao("meses")}
                  className="size-4 accent-teal-700"
                />
                Nos primeiros
                <input
                  name="desconto_meses"
                  type="number"
                  min={1}
                  max={120}
                  step={1}
                  value={meses}
                  onChange={(e) => setMeses(e.target.value)}
                  disabled={duracao !== "meses"}
                  required={duracao === "meses"}
                  data-faixa="De 1 a 120 meses."
                  className="input w-20"
                  aria-label="Quantos meses"
                />
                meses
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="desconto_duracao"
                  value="sempre"
                  checked={duracao === "sempre"}
                  onChange={() => setDuracao("sempre")}
                  className="size-4 accent-teal-700"
                />
                Para sempre
              </label>
              <ErroCampo nome="desconto_meses" cliente={erros} servidor={fe.desconto_meses} />
            </fieldset>
          </div>

          {previa && minima && (
            <section
              aria-label="Prévia do desconto"
              className={`flex flex-col gap-2 rounded-lg border p-4 text-sm ${
                minima.valor < VALOR_MINIMO_COBRANCA ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
              }`}
            >
              <p className="font-semibold">{descricaoDesconto(previa)}</p>
              <ul className="flex flex-col gap-1">
                {ASSINATURA_PLANO.map((plano) => (
                  <li key={plano}>
                    <span className="font-medium">{PLANOS[plano].label}:</span> {resumoComCupom(plano, previa)}
                  </li>
                ))}
              </ul>
              {minima.valor < VALOR_MINIMO_COBRANCA && (
                <p className="font-medium text-red-700">
                  No plano {PLANOS[minima.plano].label.toLowerCase()}, a cobrança ficaria em {brl(Math.max(0, minima.valor))}:
                  o Asaas não cobra menos de R$ 5,00. Diminua o desconto (para dar uso grátis, use um cupom de dias).
                </p>
              )}
            </section>
          )}
        </>
      )}

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
        <button
          type="submit"
          disabled={pending || (minima !== null && minima.valor < VALOR_MINIMO_COBRANCA)}
          className="btn btn-primary"
        >
          {pending ? "Criando..." : "Criar cupom"}
        </button>
        <Link href="/admin/cupons" className="btn btn-outline">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
