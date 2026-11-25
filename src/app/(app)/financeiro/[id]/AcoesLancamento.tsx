"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";

/**
 * Editar (visível no computador; no celular fica no menu) e o menu "⋯" com
 * "Desmarcar pagamento" e "Arquivar lançamento" (pede confirmação).
 */
export function AcoesLancamento({
  editarHref,
  desmarcar,
  arquivar,
}: {
  editarHref: string;
  /** Action do "Desmarcar pagamento" (só quando está pago). */
  desmarcar?: (formData: FormData) => void;
  arquivar: (formData: FormData) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  // Fecha o menu ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!menu && !confirmar) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) {
        setMenu(false);
        setConfirmar(false);
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        setConfirmar(false);
      }
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [menu, confirmar]);

  const item = "flex min-h-11 w-full items-center rounded-lg px-3 text-left text-[15px] hover:bg-[#F2FAF8]";

  return (
    <div ref={caixa} className="relative flex items-center gap-2">
      <Link href={editarHref} className="btn btn-outline hidden sm:inline-flex">
        Editar
      </Link>
      <button
        type="button"
        onClick={() => {
          setMenu(!menu);
          setConfirmar(false);
        }}
        aria-expanded={menu}
        aria-label="Mais ações"
        className="flex size-11 items-center justify-center rounded-xl border border-[#DFEBE7] bg-white hover:bg-[#F2FAF8]"
      >
        <MoreHorizontal className="size-5 text-[#12302B]" aria-hidden />
      </button>

      {menu && (
        <div className="absolute right-0 top-12 z-20 flex min-w-56 flex-col rounded-xl border border-[#DFEBE7] bg-white p-1.5 shadow-[0_8px_24px_rgba(18,48,43,0.14)]">
          <Link href={editarHref} className={`${item} font-medium text-[#12302B] sm:hidden`}>
            Editar
          </Link>
          {desmarcar && (
            <form action={desmarcar}>
              <button className={`${item} font-medium text-[#12302B]`}>Desmarcar pagamento</button>
            </form>
          )}
          <button
            type="button"
            onClick={() => {
              setMenu(false);
              setConfirmar(true);
            }}
            className={`${item} font-semibold text-[#A3261B]`}
          >
            Arquivar lançamento
          </button>
        </div>
      )}

      {confirmar && (
        <div
          role="alertdialog"
          aria-label="Confirmar arquivamento"
          className="absolute right-0 top-12 z-20 flex w-72 flex-col gap-2.5 rounded-xl border border-[#F7C9C4] bg-[#FEF3F2] p-3.5 shadow-[0_8px_24px_rgba(18,48,43,0.14)]"
        >
          <span className="text-sm text-[#7A2318]">
            <strong>Arquivar este lançamento?</strong> Ele sai das listas e dos totais do mês.
          </span>
          <span className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirmar(false)} className="btn btn-outline">
              Cancelar
            </button>
            <form action={arquivar} className="contents">
              <button className="btn border border-[#E8B4AE] bg-white font-semibold text-[#A3261B] hover:bg-[#FEF3F2]">
                Arquivar
              </button>
            </form>
          </span>
        </div>
      )}
    </div>
  );
}
