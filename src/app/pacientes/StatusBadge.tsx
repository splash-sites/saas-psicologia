import { PACIENTE_STATUS_LABEL, type PacienteStatus } from "@/lib/pacientes/types";

const STYLES: Record<PacienteStatus, string> = {
  ativo: "bg-green-100 text-green-800",
  inativo: "bg-gray-100 text-gray-700",
  alta: "bg-blue-100 text-blue-800",
};

export function StatusBadge({ status }: { status: PacienteStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {PACIENTE_STATUS_LABEL[status]}
    </span>
  );
}
