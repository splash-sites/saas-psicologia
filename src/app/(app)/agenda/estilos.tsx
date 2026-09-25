import { ESTADO_VISUAL_LABEL, type EstadoVisual } from "@/lib/agenda/grade";

// Cores por estado da consulta. Confirmada (teal cheio) e a confirmar
// (âmbar tracejado) diferem também em borda e claridade, não só no matiz.

/** Bloco na grade semanal / item da lista do dia. */
export const BLOCO_ESTADO: Record<EstadoVisual, string> = {
  confirmada: "border-teal-700 bg-teal-50 text-teal-950",
  a_confirmar: "border-dashed border-amber-700 bg-white text-amber-950",
  encerrada: "border-slate-300 bg-slate-100 text-slate-700",
  realizada: "border-slate-300 bg-slate-100 text-slate-700",
  falta: "border-orange-700 bg-orange-50 text-orange-950",
  cancelada: "border-dashed border-slate-400 bg-slate-50 text-slate-600 opacity-75",
};

const BADGE_ESTADO: Record<EstadoVisual, string> = {
  confirmada: "bg-teal-100 text-teal-900",
  a_confirmar: "border border-dashed border-amber-700 bg-amber-50 text-amber-900",
  encerrada: "bg-slate-200 text-slate-700",
  realizada: "bg-slate-200 text-slate-800",
  falta: "bg-orange-100 text-orange-900",
  cancelada: "border border-dashed border-slate-400 bg-slate-50 text-slate-600",
};

export function EstadoBadge({ estado }: { estado: EstadoVisual }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE_ESTADO[estado]}`}
    >
      {ESTADO_VISUAL_LABEL[estado]}
    </span>
  );
}

/** Fundo hachurado dos bloqueios de horário. */
export const HACHURA_BLOQUEIO: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(135deg, #f8fafc 0 6px, #e2e8f0 6px 8px)",
};
