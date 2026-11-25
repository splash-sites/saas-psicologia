import { CircleDollarSign, FileText, NotebookPen, Repeat, Video } from "lucide-react";
import type { ItemConsulta } from "./tipos";

/** Ícones pequenos da consulta: online, recorrente, com anotações, pagamento e evolução pendentes. */
export function IconesConsulta({ c, modalidade = true }: { c: ItemConsulta; /** false: a modalidade já está escrita ao lado. */ modalidade?: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {modalidade && c.modalidade === "online" && <Video className="size-[13px]" aria-label="Online" />}
      {c.recorrencia !== "nenhuma" && <Repeat className="size-[13px]" aria-label="Recorrente" />}
      {c.temAnotacoes && <NotebookPen className="size-[13px]" aria-label="Com anotações para a sessão" />}
      {c.pagamentoPendente && (
        <CircleDollarSign className="size-[13px] text-[#B45309]" aria-label="Pagamento pendente" />
      )}
      {c.evolucaoPendente && <FileText className="size-[13px] text-[#B45309]" aria-label="Evolução pendente" />}
    </span>
  );
}
