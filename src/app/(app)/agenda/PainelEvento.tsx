import Link from "next/link";
import { CalendarDays, CalendarOff, Pencil, Repeat, TriangleAlert, Video, X } from "lucide-react";
import { dataLongaBR, horaBR } from "@/lib/agenda/datas";
import { horarioDoBloqueio } from "@/lib/agenda/bloqueios";
import { RECORRENCIA_LABEL, type Recorrencia, type SyncStatus } from "@/lib/agenda/types";
import { excluirBloqueio } from "./actions";
import { CopyButton } from "./CopyButton";
import { FecharComEsc } from "./FecharComEsc";

export type EventoDoPainel = {
  id: string;
  inicio: string;
  fim: string;
  motivo: string | null;
  dia_inteiro: boolean;
  online: boolean;
  meet_link: string | null;
  serie_id: string | null;
  recorrencia: Recorrencia;
  sync_status: SyncStatus;
  sync_erro: string | null;
  /** Link da chamada: o Meet do Google, senão o link fixo (linkDoEvento). */
  link: string | null;
};

type Props = {
  e: EventoDoPainel;
  /** URL da agenda sem o painel aberto. */
  fecharHref: string;
  /** Para onde voltar depois de remover. */
  voltarHref: string;
  /** URL da agenda com este painel aberto (volta do "Editar"). */
  aquiHref: string;
};

// Painel lateral de um evento (0047): horário, link do Meet, editar e remover.
export function PainelEvento({ e, fecharHref, voltarHref, aquiHref }: Props) {
  const serie = Boolean(e.serie_id);
  const editarHref = `/agenda/eventos/${e.id}/editar?${new URLSearchParams({ voltar: aquiHref })}`;

  return (
    <div className="fixed inset-0 z-50">
      <FecharComEsc href={fecharHref} />
      <Link href={fecharHref} scroll={false} aria-label="Fechar detalhes" className="absolute inset-0 bg-slate-900/20" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="painel-evento-titulo"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl"
      >
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              <CalendarOff className="size-3.5" aria-hidden />
              Evento
            </span>
            {e.recorrencia !== "nenhuma" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
                <Repeat className="size-3.5" aria-hidden />
                {RECORRENCIA_LABEL[e.recorrencia]}
              </span>
            )}
            <Link href={fecharHref} scroll={false} aria-label="Fechar" className="btn btn-outline ml-auto size-10 !min-h-0 !p-0">
              <X className="size-5" aria-hidden />
            </Link>
          </div>

          <h2 id="painel-evento-titulo" className="text-xl font-bold">
            {e.motivo || "Evento"}
          </h2>

          <span className="flex items-center gap-2 text-sm text-slate-800">
            <CalendarDays className="size-4 text-slate-500" aria-hidden />
            <span className="first-letter:uppercase">
              {e.dia_inteiro ? `${dataLongaBR(e.inicio)} · ${horarioDoBloqueio(e)}` : `${dataLongaBR(e.inicio)} · ${horaBR(e.inicio)}–${horaBR(e.fim)}`}
            </span>
          </span>

          {e.online && e.link && (
            <div className="flex flex-col gap-2 rounded-lg bg-teal-50/70 p-3">
              <a href={e.link} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full">
                <Video className="size-4" aria-hidden />
                Entrar na chamada
              </a>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs text-teal-900">{e.link}</span>
                <CopyButton value={e.link} />
              </div>
              <span className="text-xs text-teal-900">Ninguém é convidado: copie o link e mande para quem for participar.</span>
            </div>
          )}
          {e.online && !e.link && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {e.sync_status === "erro"
                  ? "Não foi possível criar o link no Google Agenda. Abra Editar e salve de novo para tentar outra vez."
                  : "O link da chamada ainda não foi criado. Conecte o Google Agenda ou cadastre um link fixo em Configurações."}
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 p-5 sm:p-6">
          <Link href={editarHref} className="btn btn-outline w-full">
            <Pencil className="size-4" aria-hidden />
            Editar{serie ? " só esta data" : ""}
          </Link>
          <form action={excluirBloqueio.bind(null, e.id, "este", voltarHref)}>
            <button className="w-full text-sm text-red-700 hover:opacity-80">{serie ? "Remover só este" : "Remover evento"}</button>
          </form>
          {serie && (
            <form action={excluirBloqueio.bind(null, e.id, "proximos", voltarHref)}>
              <button className="w-full text-sm text-red-700 hover:opacity-80">Remover este e os próximos</button>
            </form>
          )}
        </div>
      </aside>
    </div>
  );
}
