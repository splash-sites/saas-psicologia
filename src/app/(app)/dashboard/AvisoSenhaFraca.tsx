"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { aoMudarSenhaFraca, marcarSenhaFraca, senhaFracaMarcada, SENHA_MINIMA } from "@/lib/auth/senha";

/** Sugere trocar a senha curta (de antes da regra de 8). Pode fechar; não bloqueia. */
export function AvisoSenhaFraca() {
  const fraca = useSyncExternalStore(aoMudarSenhaFraca, senhaFracaMarcada, () => false);
  if (!fraca) return null;
  return (
    <div role="status" className="alert alert-warning flex items-start justify-between gap-3">
      <p>
        Sua senha tem menos de {SENHA_MINIMA} caracteres. Para proteger os prontuários, troque por uma mais forte.{" "}
        <Link href="/redefinir-senha" className="font-medium underline">
          Trocar senha
        </Link>
      </p>
      <button
        type="button"
        onClick={() => marcarSenhaFraca(false)}
        aria-label="Fechar aviso da senha"
        className="rounded p-1 hover:bg-black/5"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
