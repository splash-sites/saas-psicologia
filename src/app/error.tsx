"use client";

import { TelaDeErro } from "@/components/TelaDeErro";

// Erro inesperado fora do painel (login, cadastro, termos...).
export default function Erro({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <TelaDeErro error={error} retry={retry} />
      </div>
    </main>
  );
}
