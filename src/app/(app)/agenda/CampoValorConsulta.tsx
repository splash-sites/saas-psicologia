"use client";

import { ErroCampo } from "@/components/ErroCampo";
import type { ErrosValidacao } from "@/lib/form/validacao";
import { VALOR_MAXIMO } from "@/lib/dinheiro";

/** Valor da consulta (R$): vem do paciente, editável; vazio = sem cobrança. */
export function CampoValorConsulta({
  valor,
  onChange,
  erros,
  servidor,
}: {
  valor: string;
  onChange: (v: string) => void;
  erros: ErrosValidacao;
  servidor?: string[];
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      Valor da sessão (R$)
      <input
        name="valor"
        type="number"
        step="0.01"
        min="0.01"
        max={VALOR_MAXIMO}
        data-faixa="O valor mínimo é R$ 0,01."
        data-passo="Use no máximo 2 casas decimais (ex.: 150,50)."
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Sem cobrança"
        className="input"
      />
      <span className="text-xs text-slate-500">
        Depois da sessão, entra no Financeiro como a receber. Em branco: sem cobrança.
      </span>
      <ErroCampo nome="valor" cliente={erros} servidor={servidor} />
    </label>
  );
}
