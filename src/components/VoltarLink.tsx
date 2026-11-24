import Link from "next/link";
import { IconeVoltar } from "./IconeVoltar";

// Breadcrumb "← Voltar" padronizado — mesmo ícone (lucide ChevronLeft) já
// usado na paginação (agenda, financeiro, lembretes), em vez do caractere
// unicode "←" (renderiza feio/inconsistente em algumas fontes/telas).
// Área de toque de 44 px (o texto sozinho tinha 20 px e, no celular, o toque
// caía fora) com o mesmo lugar no layout (margem negativa), fundo ao tocar e
// a seta vira "carregando" enquanto a página anterior abre.
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
      className="-mx-2 -my-3 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 py-3 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 active:bg-slate-200"
    >
      <IconeVoltar />
      {children}
    </Link>
  );
}
