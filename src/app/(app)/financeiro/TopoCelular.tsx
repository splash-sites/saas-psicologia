import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

/**
 * Topo enxuto das telas do Financeiro no celular (2026-11-25, decisão do
 * usuário: o topo tinha três linhas de botões). Mesmo padrão da Agenda no
 * celular: título (+ "Novo lançamento" redondo) numa linha e "‹ Novembro de
 * 2026 ›" na outra; fora do mês atual, "Voltar para o mês atual" embaixo. No
 * computador continua o CabecalhoPagina.
 */
export function TopoCelular({
  titulo,
  voltar,
  periodo,
  anteriorHref,
  proximoHref,
  mesAtualHref,
  novo,
  descricao,
}: {
  titulo: string;
  voltar?: { href: string; rotulo: string };
  /** "Novembro de 2026". */
  periodo: string;
  anteriorHref: string;
  proximoHref: string;
  /** Link de volta ao mês atual; null quando já está nele. */
  mesAtualHref: string | null;
  /** Mostra o "+" de novo lançamento. */
  novo?: boolean;
  descricao?: string;
}) {
  // "novembro de 2026" vem minúsculo de rotuloMes.
  const mes = periodo.charAt(0).toUpperCase() + periodo.slice(1);
  const seta = "flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#DFEBE7] bg-white hover:bg-[#F2FAF8]";
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {voltar && (
        <Link href={voltar.href} className="-mb-1 inline-flex w-fit items-center gap-1 text-sm font-medium text-[#3D524D]">
          <ChevronLeft className="size-4" aria-hidden />
          {voltar.rotulo}
        </Link>
      )}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-[22px] font-bold tracking-tight text-[#12302B]">{titulo}</h1>
        {novo && (
          <Link
            href="/financeiro/novo"
            aria-label="Novo lançamento"
            className="flex size-11 items-center justify-center rounded-xl bg-[#0F766E] text-white shadow-[0_2px_6px_rgba(18,48,43,0.2)]"
          >
            <Plus className="size-5" aria-hidden />
          </Link>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <Link href={anteriorHref} aria-label="Mês anterior" className={seta}>
          <ChevronLeft className="size-[18px] text-[#12302B]" aria-hidden />
        </Link>
        {mesAtualHref ? (
          <Link href={mesAtualHref} className="flex flex-col items-center leading-tight" aria-label={`${mes}. Voltar para o mês atual`}>
            <span className="text-base font-bold text-[#12302B]">{mes}</span>
            <span className="text-[12px] font-semibold text-[#0F766E]">Voltar para o mês atual</span>
          </Link>
        ) : (
          <span className="text-base font-bold text-[#12302B]">{mes}</span>
        )}
        <Link href={proximoHref} aria-label="Próximo mês" className={seta}>
          <ChevronRight className="size-[18px] text-[#12302B]" aria-hidden />
        </Link>
      </div>
      {descricao && <p className="text-sm text-[#4A5F5A]">{descricao}</p>}
    </div>
  );
}
