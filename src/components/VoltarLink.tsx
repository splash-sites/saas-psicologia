import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// Breadcrumb "← Voltar" padronizado — mesmo ícone (lucide ChevronLeft) já
// usado na paginação (agenda, financeiro, lembretes), em vez do caractere
// unicode "←" (renderiza feio/inconsistente em algumas fontes/telas).
export function VoltarLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm text-slate-500 hover:underline"
    >
      <ChevronLeft className="size-4" aria-hidden />
      {children}
    </Link>
  );
}
