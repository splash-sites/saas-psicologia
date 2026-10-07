"use client";

import { Printer } from "lucide-react";

export function ImprimirButton() {
  return (
    <button type="button" className="btn btn-primary" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden />
      Imprimir / salvar PDF
    </button>
  );
}
