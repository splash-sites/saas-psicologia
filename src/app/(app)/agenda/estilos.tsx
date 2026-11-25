import { ESTADO_VISUAL_LABEL, type EstadoVisual } from "@/lib/agenda/grade";

// Cores pastel por estado da consulta (redesenho de 2026-11-24, canvas
// "Blocos-pastel" e "Celular"). Sem borda tracejada: os estados diferem pelo
// fundo e pela borda fina; cancelada fica branca com o nome riscado.

const SOMBRA = "shadow-[0_1px_2px_rgba(18,48,43,0.06),0_2px_6px_rgba(18,48,43,0.05)]";

/** Bloco na grade semanal / cartão da lista do dia: fundo, borda e cor do nome. */
export const BLOCO_ESTADO: Record<EstadoVisual, string> = {
  confirmada: `border-[#B9E0D8] bg-[#DCF0EC] text-[#0B3F3A] ${SOMBRA}`,
  a_confirmar: `border-[#EBD49A] bg-[#FBF2DC] text-[#3B2F0E] ${SOMBRA}`,
  encerrada: "border-[#DDE6E3] bg-[#EFF3F2] text-[#3D524D]",
  realizada: "border-[#DDE6E3] bg-[#EFF3F2] text-[#3D524D]",
  falta: `border-[#F1C2A8] bg-[#FCE6DA] text-[#7A2A0A] ${SOMBRA}`,
  cancelada: "border-[#B9C8C4] bg-white text-[#5B6E69]",
};

/** Cor da segunda linha (hora, estado, modalidade) de cada estado. */
export const SUB_ESTADO: Record<EstadoVisual, string> = {
  confirmada: "text-[#2C6660]",
  a_confirmar: "text-[#6B5520]",
  encerrada: "text-[#5B6E69]",
  realizada: "text-[#5B6E69]",
  falta: "text-[#8F3A14]",
  cancelada: "text-[#5B6E69]",
};

const BADGE_ESTADO: Record<EstadoVisual, string> = {
  confirmada: "border border-[#B9E0D8] bg-[#DCF0EC] text-[#0B3F3A]",
  a_confirmar: "border border-[#EBD49A] bg-[#FBF2DC] text-[#3B2F0E]",
  encerrada: "border border-[#DDE6E3] bg-[#EFF3F2] text-[#3D524D]",
  realizada: "border border-[#DDE6E3] bg-[#EFF3F2] text-[#3D524D]",
  falta: "border border-[#F1C2A8] bg-[#FCE6DA] text-[#7A2A0A]",
  cancelada: "border border-[#B9C8C4] bg-white text-[#5B6E69] line-through",
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

/** Fundo dos eventos (bloqueios): cinza-esverdeado com listras finas e suaves. */
export const HACHURA_BLOQUEIO: React.CSSProperties = {
  backgroundColor: "#F1F4F3",
  backgroundImage: "repeating-linear-gradient(135deg, transparent 0, transparent 7px, #E7EDEB 7px, #E7EDEB 8px)",
};

/** Faixa do feriado no topo do dia (0038); ponto facultativo mais leve. */
export function classeFaixaFeriado(facultativo: boolean): string {
  return facultativo
    ? "border-rose-100 bg-rose-50/60 text-rose-700"
    : "border-rose-200 bg-rose-100 text-rose-900";
}

/** Fundo da coluna/dia de feriado. */
export function classeFundoFeriado(facultativo: boolean): string {
  return facultativo ? "bg-rose-50/30" : "bg-rose-50/70";
}

/** Etiqueta rosa de aniversário do paciente (item H). */
export const CLASSE_ANIVERSARIO = "border-[#F5C6D7] bg-[#FCE7EF] text-[#8A1F4C]";

/** "Ana", "Ana e Bia", "Ana, Bia e Caio". */
export function listaNomes(nomes: string[]): string {
  return nomes.length <= 1 ? (nomes[0] ?? "") : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}
