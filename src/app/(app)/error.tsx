"use client";

import { TelaDeErro } from "@/components/TelaDeErro";

// Erro inesperado numa página do painel: o menu continua de pé.
export default function ErroNoPainel({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <TelaDeErro error={error} retry={retry} />
    </div>
  );
}
