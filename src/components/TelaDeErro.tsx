"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * Conteúdo das telas de erro inesperado (error.tsx). Nunca mostra a mensagem
 * do erro: a do servidor vem genérica e em inglês, e a do navegador pode ter
 * detalhe técnico. Só o código (digest), que liga ao log do servidor e ajuda
 * o suporte a achar o problema.
 */
export function TelaDeErro({ error, retry }: { error: unknown; retry: () => void }) {
  const codigo =
    error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : null;

  return (
    <div className="card flex flex-col items-center gap-4 px-4 py-8 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle className="size-5" aria-hidden />
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-slate-900">Algo deu errado</h1>
        <p className="text-sm text-slate-600">
          Não conseguimos carregar esta página. Tente de novo; se continuar,
          escreva para contato@splashsistemas.com.br.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => retry()} className="btn btn-primary">
          Tentar de novo
        </button>
        <Link href="/dashboard" className="btn btn-outline">
          Ir para o painel
        </Link>
      </div>
      {codigo && <p className="text-xs text-slate-400">Código do erro: {codigo}</p>}
    </div>
  );
}
