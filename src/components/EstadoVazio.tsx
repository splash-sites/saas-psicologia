import type { LucideIcon } from "lucide-react";

// Estado vazio: explica o que falta e oferece o próximo passo, em vez de
// deixar um espaço em branco.
export function EstadoVazio({
  icon: Icon,
  titulo,
  texto,
  children,
}: {
  icon: LucideIcon;
  titulo: string;
  texto?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-4 py-8 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-teal-50 text-teal-700">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-medium text-slate-900">{titulo}</p>
        {texto && <p className="text-sm text-slate-500">{texto}</p>}
      </div>
      {children && <div className="flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}
