import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Consulta } from "@/lib/agenda/types";
import {
  MODALIDADE_LABEL,
  CONSULTA_STATUS_LABEL,
  RECORRENCIA_LABEL,
  SYNC_STATUS_LABEL,
} from "@/lib/agenda/types";
import { horaBR, dataLongaBR } from "@/lib/agenda/datas";
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
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <Link href="/agenda" className="text-sm text-gray-500 hover:underline">
        ← Agenda
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {c.pacientes?.nome ?? "Consulta"}
          </h1>
          <p className="text-sm capitalize text-gray-600">
            {dataLongaBR(c.inicio)} · {horaBR(c.inicio)}–{horaBR(c.fim)}
          </p>
        </div>
        {c.status !== "cancelada" && (
          <Link
            href={`/agenda/${id}/editar`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Editar
          </Link>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border p-4 text-sm">
        <Item rotulo="Modalidade" valor={MODALIDADE_LABEL[c.modalidade]} />
        <Item rotulo="Status" valor={CONSULTA_STATUS_LABEL[c.status]} />
        <Item rotulo="Recorrência" valor={RECORRENCIA_LABEL[c.recorrencia]} />
        {c.pacientes && (
          <div className="flex flex-col">
            <dt className="text-xs text-gray-500">Paciente</dt>
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

      {c.observacoes && (
        <section className="flex flex-col gap-1 text-sm">
          <h2 className="font-medium">Observações</h2>
          <p className="whitespace-pre-wrap text-gray-700">{c.observacoes}</p>
        </section>
      )}

      {c.modalidade === "online" && c.status !== "cancelada" && (
        <section className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
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
            <p className="text-gray-500">
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
                  : "text-gray-500"
            }
          >
            {SYNC_STATUS_LABEL[c.sync_status]}
            {c.sync_status === "erro" && c.sync_erro ? ` — ${c.sync_erro}` : ""}
          </span>
          {c.sync_status !== "desativada" && (
            <form action={sincronizarConsultaAgora.bind(null, id)}>
              <button className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50">
                Sincronizar agora
              </button>
            </form>
          )}
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
    </main>
  );
}

function Item({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-gray-500">{rotulo}</dt>
      <dd>{valor}</dd>
    </div>
  );
}
