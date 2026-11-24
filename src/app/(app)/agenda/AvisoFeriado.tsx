import { CalendarHeart } from "lucide-react";

/** Aviso de feriado ao marcar/remarcar consulta: só informa (0038). */
export function AvisoFeriado({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900" role="status">
      <CalendarHeart className="mt-0.5 size-4 shrink-0" aria-hidden />
      {texto}
    </p>
  );
}
