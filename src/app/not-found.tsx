import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata = { title: "Página não encontrada" };

// Endereço que não existe (fora do painel). No painel, ver (app)/not-found.tsx.
export default function NaoEncontrada() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card flex w-full max-w-sm flex-col gap-5 p-6 sm:p-8">
        <Logo className="h-10 w-auto" />
        <div className="flex flex-col gap-2">
          <h1 className="text-lg font-semibold">Página não encontrada</h1>
          <p className="text-sm text-slate-600">
            O endereço pode estar errado ou a página não existe mais.
          </p>
        </div>
        <Link href="/dashboard" className="btn btn-primary w-full">
          Ir para o painel
        </Link>
      </div>
    </main>
  );
}
