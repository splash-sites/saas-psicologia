import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Destino = { href: string; rotulo: string };

/**
 * Navegação de período igual em Agenda, Financeiro e Lembretes:
 * [<] [Hoje] [>] e o período por extenso ao lado. Setas só com ícone (o
 * nome vai no aria-label); o botão do meio volta ao período padrão.
 */
export function NavegacaoPeriodo({
  anterior,
  atual,
  proximo,
  periodo,
  scroll,
}: {
  anterior: Destino;
  atual: Destino;
  proximo: Destino;
  /** Ex.: "2 – 8 de novembro de 2026", "Novembro de 2026". */
  periodo: React.ReactNode;
  scroll?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-1">
        <Link
          href={anterior.href}
          scroll={scroll}
          className="btn btn-outline size-10 !min-h-0 !p-0"
          aria-label={anterior.rotulo}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
        <Link href={atual.href} scroll={scroll} className="btn btn-outline">
          {atual.rotulo}
        </Link>
        <Link
          href={proximo.href}
          scroll={scroll}
          className="btn btn-outline size-10 !min-h-0 !p-0"
          aria-label={proximo.rotulo}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      <span className="inline-block text-base font-semibold first-letter:uppercase">{periodo}</span>
    </div>
  );
}
