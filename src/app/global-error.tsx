"use client";

import "./globals.css";
import { TelaDeErro } from "@/components/TelaDeErro";

// Erro no próprio layout raiz: substitui o documento inteiro, por isso tem
// <html> e <body> próprios (e importa o CSS, que o layout não vai carregar).
export default function ErroGeral({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="pt-BR">
      <body>
        <title>Algo deu errado · Gradatim</title>
        <main className="flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-sm">
            <TelaDeErro error={error} retry={retry} />
          </div>
        </main>
      </body>
    </html>
  );
}
