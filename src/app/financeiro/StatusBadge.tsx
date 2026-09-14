import { STATUS_EXIBICAO_LABEL, type StatusExibicao } from "@/lib/financeiro/types";

const STYLES: Record<StatusExibicao, string> = {
  pago: "bg-green-100 text-green-800",
  pendente: "bg-amber-100 text-amber-800",
  atrasado: "bg-red-100 text-red-800",
};

export function StatusBadge({ status }: { status: StatusExibicao }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {STATUS_EXIBICAO_LABEL[status]}
    </span>
  );
}
