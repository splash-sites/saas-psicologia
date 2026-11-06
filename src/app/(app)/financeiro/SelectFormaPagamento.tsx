import { FORMAS_PAGAMENTO, FORMA_PAGAMENTO_LABEL } from "@/lib/financeiro/types";

/** Lista fixa de formas de pagamento (migration 0024). */
export function SelectFormaPagamento({
  defaultValue,
  className = "input",
}: {
  defaultValue?: string | null;
  className?: string;
}) {
  return (
    <select name="forma_pagamento" defaultValue={defaultValue ?? ""} className={className}>
      <option value="">Não informada</option>
      {FORMAS_PAGAMENTO.map((f) => (
        <option key={f} value={f}>
          {FORMA_PAGAMENTO_LABEL[f]}
        </option>
      ))}
    </select>
  );
}
