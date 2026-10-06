import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VoltarLink } from "@/components/VoltarLink";
import type { Consulta } from "@/lib/agenda/types";
import {
  MODALIDADE_LABEL,
  CONSULTA_STATUS_LABEL,
  RECORRENCIA_LABEL,
  SYNC_STATUS_LABEL,
} from "@/lib/agenda/types";
import { horaBR, dataLongaBR, dataChaveBR } from "@/lib/agenda/datas";
import { cancelarConsulta, sincronizarConsultaAgora } from "../actions";
import { CopyButton } from "../CopyButton";

type Row = Consulta & { pacientes: { id: string; nome: string } | null };

export default async function ConsultaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("consultas")
    .select("*, pacientes(id, nome)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) notFound();
  const c = data as unknown as Row;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <VoltarLink href="/agenda">Agenda</VoltarLink>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {c.pacientes?.nome ?? "Consulta"}
          </h1>
          <p className="text-sm first-letter:uppercase text-slate-600">
            {dataLongaBR(c.inicio)} · {horaBR(c.inicio)}–{horaBR(c.fim)}
          </p>
        </div>
        {c.status !== "cancelada" && (
          <Link
            href={`/agenda/${id}/editar`}
            className="btn btn-outline"
          >
            Editar
          </Link>
        )}
      </div>

      <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 gap-y-3 card text-sm">
        <Item rotulo="Modalidade" valor={MODALIDADE_LABEL[c.modalidade]} />
        <Item rotulo="Status" valor={CONSULTA_STATUS_LABEL[c.status]} />
        <Item rotulo="Recorrência" valor={RECORRENCIA_LABEL[c.recorrencia]} />
        {c.pacientes && (
          <div className="flex flex-col">
            <dt className="text-xs text-slate-500">Paciente</dt>
            <dd>
              <Link
                href={`/pacientes/${c.pacientes.id}`}
                className="underline"
              >
                {c.pacientes.nome}
              </Link>
            </dd>
          </div>
        )}
      </dl>

      {c.pacientes && c.status !== "cancelada" && (
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/pacientes/${c.pacientes.id}/evolucoes/nova?consulta=${id}&data=${dataChaveBR(c.inicio)}`}
            className="w-fit btn btn-outline"
          >
            Registrar evolução desta sessão
          </Link>
          <Link
            href={`/financeiro/novo?paciente=${c.pacientes.id}&consulta=${id}&data=${dataChaveBR(c.inicio)}`}
            className="w-fit btn btn-outline"
          >
            Lançar pagamento desta sessão
          </Link>
        </div>
      )}

      {c.observacoes && (
        <section className="flex flex-col gap-1 text-sm">
          <h2 className="font-medium">Observações</h2>
          <p className="whitespace-pre-wrap text-slate-700">{c.observacoes}</p>
        </section>
      )}

      {c.modalidade === "online" && c.status !== "cancelada" && (
        <section className="flex flex-col gap-2 card text-sm">
          <h2 className="font-medium">Videochamada</h2>
          {c.meet_link ? (
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={c.meet_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 underline break-all"
              >
                {c.meet_link}
              </a>
              <CopyButton value={c.meet_link} />
            </div>
          ) : (
            <p className="text-slate-500">
              Link do Meet ainda não gerado. Ele aparece após a sincronização com
              o Google Calendar.
            </p>
          )}
        </section>
      )}

      {c.status !== "cancelada" && (
        <section className="flex flex-wrap items-center gap-3 text-sm">
          <span
            className={
              c.sync_status === "erro"
                ? "text-red-600"
                : c.sync_status === "sincronizada"
                  ? "text-green-700"
                  : "text-slate-500"
            }
          >
            {SYNC_STATUS_LABEL[c.sync_status]}
            {(c.sync_status === "erro" || c.sync_status === "desativada") &&
            c.sync_erro
              ? ` — ${c.sync_erro}`
              : ""}
          </span>
          {c.sync_status === "desativada" && (
            <Link href="/configuracoes" className="text-xs underline">
              Ir para Configurações
            </Link>
          )}
          {/* Também disponível quando desativada: serve para tentar de novo
              depois de reconectar o Google. */}
          <form action={sincronizarConsultaAgora.bind(null, id)}>
            <button className="btn btn-outline btn-sm">
              Sincronizar agora
            </button>
          </form>
        </section>
      )}

      {c.status !== "cancelada" && (
        <div className="flex flex-wrap gap-3 border-t pt-4">
          <form action={cancelarConsulta.bind(null, id, "esta")}>
            <button className="text-sm text-red-600 hover:underline">
              Cancelar esta consulta
            </button>
          </form>
          {c.serie_id && (
            <form action={cancelarConsulta.bind(null, id, "serie")}>
              <button className="text-sm text-red-600 hover:underline">
                Cancelar esta e as próximas da série
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function Item({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-slate-500">{rotulo}</dt>
      <dd>{valor}</dd>
    </div>
  );
}
