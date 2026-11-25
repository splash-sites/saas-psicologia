import { CLASSE_TOM, type Situacao } from "@/lib/financeiro/situacao";

/** Situação do lançamento: "Pago em 03/11", "Atrasado há 22 dias", "A vencer em 10/12". */
export function Pilula({ situacao, grande = false }: { situacao: Situacao; grande?: boolean }) {
  return (
    <span
      className={`inline-flex w-fit items-center whitespace-nowrap rounded-full border font-semibold ${
        grande ? "px-3 py-1 text-[13px]" : "px-2.5 py-0.5 text-xs"
      } ${CLASSE_TOM[situacao.tom]}`}
    >
      {situacao.texto}
    </span>
  );
}
