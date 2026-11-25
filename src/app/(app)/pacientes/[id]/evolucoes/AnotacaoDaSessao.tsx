import Link from "next/link";
import { NotebookPen } from "lucide-react";
import { dataBR } from "@/lib/agenda/datas";

/**
 * "Anotações para a sessão" (0043) em modo leitura: no topo do formulário da
 * evolução e na página da evolução. Editar é pelo painel da consulta.
 */
export function AnotacaoDaSessao({
  anotacao,
  rotulo = "Você anotou para esta sessão",
}: {
  anotacao: { id: string; inicio: string; texto: string };
  rotulo?: string;
}) {
  return (
    <section className="flex flex-col gap-1.5 rounded-md border border-sky-200 bg-sky-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-sky-950">
          <NotebookPen className="size-4" aria-hidden />
          {rotulo}
        </h2>
        <Link href={`/agenda?consulta=${anotacao.id}`} className="text-xs font-medium text-teal-800 hover:opacity-80">
          Editar na consulta de {dataBR(anotacao.inicio)}
        </Link>
      </div>
      <p className="whitespace-pre-wrap text-sm text-slate-800" data-sensivel>
        {anotacao.texto}
      </p>
    </section>
  );
}
