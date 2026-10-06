import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VoltarLink } from "@/components/VoltarLink";
import { CAMPOS_EVOLUCAO, type Evolucao } from "@/lib/prontuario/types";
import { arquivarEvolucao } from "../actions";
import { ArquivarForm } from "./ArquivarForm";

function dataBR(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}
function dataHoraBR(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

export default async function EvolucaoDetailPage({
  params,
}: {
  params: Promise<{ id: string; evolucaoId: string }>;
}) {
  const { id, evolucaoId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("evolucoes")
    .select("*")
    .eq("id", evolucaoId)
    .eq("paciente_id", id)
    .maybeSingle();

  if (!data) notFound();
  const e = data as Evolucao;
  const arquivada = Boolean(e.deleted_at);
  const editado = e.updated_at !== e.created_at;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <VoltarLink href={`/pacientes/${id}/evolucoes`}>Evoluções</VoltarLink>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            Sessão de {dataBR(e.data_sessao)}
          </h1>
          <p className="text-xs text-slate-500">
            Registrada em {dataHoraBR(e.created_at)}
            {editado && ` · editada em ${dataHoraBR(e.updated_at)}`}
          </p>
        </div>
        {!arquivada && (
          <Link
            href={`/pacientes/${id}/evolucoes/${evolucaoId}/editar`}
            className="btn btn-outline"
          >
            Editar
          </Link>
        )}
      </div>

      {arquivada && (
        <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
          Evolução arquivada em {dataHoraBR(e.deleted_at!)}.
          {e.deleted_motivo && ` Motivo: ${e.deleted_motivo}`}
        </p>
      )}

      <div className="flex flex-col gap-5">
        {CAMPOS_EVOLUCAO.map((campo) => (
          <section key={campo.nome} className="flex flex-col gap-1">
            <h2 className="text-sm font-medium">{campo.rotulo}</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {e[campo.nome]}
            </p>
          </section>
        ))}

        {e.notas_privadas && (
          <section className="flex flex-col gap-1 rounded-md border border-amber-200 bg-amber-50 p-3">
            <h2 className="text-sm font-medium">Notas técnicas privadas</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {e.notas_privadas}
            </p>
          </section>
        )}
      </div>

      {e.consulta_id && (
        <Link
          href={`/agenda/${e.consulta_id}`}
          className="text-sm text-slate-500 underline"
        >
          Ver consulta vinculada
        </Link>
      )}

      {!arquivada && (
        <div className="border-t pt-4">
          <ArquivarForm action={arquivarEvolucao.bind(null, id, evolucaoId)} />
        </div>
      )}
    </div>
  );
}
