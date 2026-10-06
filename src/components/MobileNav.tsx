"use client";

import { useEffect, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { NavLinks } from "./NavLinks";
import { ModoPrivado } from "./ModoPrivado";
import { signOut } from "@/app/(app)/dashboard/actions";

// Barra superior + menu deslizante, só em telas < md (no desktop existe a
// barra lateral fixa).
export function MobileNav({ email }: { email: string }) {
  const [aberto, setAberto] = useState(false);

  // Esc fecha; enquanto aberto, a página de trás não rola.
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [aberto]);

  return (
    <div className="md:hidden">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
        <span className="text-sm font-semibold text-teal-800">
          Gestão para Psicólogos
        </span>
        <div className="flex items-center gap-2">
          <ModoPrivado compacto />
          <button
            type="button"
            aria-label="Abrir menu"
            aria-expanded={aberto}
            onClick={() => setAberto(true)}
            className="btn btn-outline size-11 !min-h-0 !p-0"
          >
            <Menu className="size-5" aria-hidden />
          </button>
        </div>
      </header>

      {aberto && (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setAberto(false)}
            className="absolute inset-0 bg-slate-900/40"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col gap-4 bg-white p-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-teal-800">Menu</span>
              <button
                type="button"
                aria-label="Fechar menu"
                onClick={() => setAberto(false)}
                className="btn btn-outline size-11 !min-h-0 !p-0"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <NavLinks onNavigate={() => setAberto(false)} />

            <div className="mt-auto flex flex-col gap-2 border-t border-slate-200 pt-4">
              <span className="truncate text-xs text-slate-500">{email}</span>
              <form action={signOut}>
                <button className="btn btn-outline w-full">
                  <LogOut className="size-4" aria-hidden />
                  Sair
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
