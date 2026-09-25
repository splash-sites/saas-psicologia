"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// Modo privado: borra nomes de pacientes e valores marcados com
// `data-sensivel`, para a psicóloga compartilhar a tela (ex.: numa sessão
// online) sem expor dados de outros pacientes. Atalho: Alt+O.
// O estado fica no <html data-privado> e no localStorage do navegador; o
// SCRIPT_MODO_PRIVADO aplica antes da pintura para não "piscar" os nomes.

const CHAVE = "modo-privado";

export const SCRIPT_MODO_PRIVADO = `try{if(localStorage.getItem("${CHAVE}")==="1")document.documentElement.dataset.privado=""}catch(e){}`;

function aplicar(ligado: boolean) {
  if (ligado) document.documentElement.dataset.privado = "";
  else delete document.documentElement.dataset.privado;
  try {
    localStorage.setItem(CHAVE, ligado ? "1" : "0");
  } catch {
    // Sem storage (aba anônima bloqueada): vale só até recarregar.
  }
  window.dispatchEvent(new Event(CHAVE));
}

function lerEstado(): boolean {
  return "privado" in document.documentElement.dataset;
}

export function ModoPrivado({ compacto = false }: { compacto?: boolean }) {
  const [ligado, setLigado] = useState(false);

  useEffect(() => {
    const sync = () => setLigado(lerEstado());
    sync();
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === "KeyO") {
        e.preventDefault();
        aplicar(!lerEstado());
      }
    };
    window.addEventListener(CHAVE, sync);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(CHAVE, sync);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const Icone = ligado ? Eye : EyeOff;
  const rotulo = ligado ? "Mostrar dados" : "Ocultar dados";

  if (compacto) {
    return (
      <button
        type="button"
        aria-pressed={ligado}
        aria-label={`${rotulo} (Alt+O)`}
        title={`${rotulo} (Alt+O)`}
        onClick={() => aplicar(!ligado)}
        className={`btn size-11 !min-h-0 !p-0 ${
          ligado ? "border border-teal-600 bg-teal-50 text-teal-800" : "btn-outline"
        }`}
      >
        <Icone className="size-5" aria-hidden />
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={ligado}
      title="Borra nomes e valores para compartilhar a tela (Alt+O)"
      onClick={() => aplicar(!ligado)}
      className={`btn w-full justify-between ${
        ligado ? "border border-teal-600 bg-teal-50 text-teal-800" : "btn-outline"
      }`}
    >
      <span className="inline-flex items-center gap-2">
        <Icone className="size-4" aria-hidden />
        {rotulo}
      </span>
      <kbd className="rounded border border-slate-300 bg-white px-1.5 text-[11px] font-semibold text-slate-500">
        Alt O
      </kbd>
    </button>
  );
}
