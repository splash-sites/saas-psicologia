import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VoltarLink } from "@/components/VoltarLink";
import type { Evolucao } from "@/lib/prontuario/types";

export const metadata = { title: "Evoluções" };

function dataBR(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export default async function EvolucoesTimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ arquivadas?: string }>;
}) {
  const { id } = await params;
  const { arquivadas } = await searchParams;
  const mostrarArquivadas = arquivadas === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: paciente } = await supabase
    .from("pacientes")
    .select("id, nome")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!paciente) notFound();

  let q = supabase
    .from("evolucoes")
    .select("id, data_sessao, demanda, deleted_at, deleted_motivo, updated_at")
    .eq("paciente_id", id)
    .order("data_sessao", { ascending: false });
  q = mostrarArquivadas ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);

  const { data: evolucoes } = await q;
  const lista = (evolucoes ?? []) as Pick<
    Evolucao,
    "id" | "data_sessao" | "demanda" | "deleted_at" | "deleted_motivo" | "updated_at"
  >[];

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <VoltarLink href={`/pacientes/${id}`}>{paciente.nome}</VoltarLink>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">
          Evoluções {mostrarArquivadas && "arquivadas"}
        </h1>
        {!mostrarArquivadas && (
          <Link
            href={`/pacientes/${id}/evolucoes/nova`}
            className="btn btn-primary"
          >
            Nova evolução
          </Link>
        )}
      </div>

      <nav className="flex gap-3 text-sm">
        <Link
          href={`/pacientes/${id}/evolucoes`}
          className={!mostrarArquivadas ? "font-medium underline" : "text-slate-500"}
        >
          Ativas
        </Link>
        <Link
          href={`/pacientes/${id}/evolucoes?arquivadas=1`}
          className={mostrarArquivadas ? "font-medium underline" : "text-slate-500"}
        >
          Arquivadas
        </Link>
      </nav>

      {lista.length === 0 ? (
        <p className="text-sm text-slate-500">
          {mostrarArquivadas
            ? "Nenhuma evolução arquivada."
            : "Nenhuma evolução registrada ainda."}
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {lista.map((e) => (
            <li key={e.id}>
              <Link
                href={`/pacientes/${id}/evolucoes/${e.id}`}
                className="block card hover:bg-slate-50"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-medium">
                    Sessão de {dataBR(e.data_sessao)}
                  </span>
                  {e.deleted_at && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      Arquivada
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                  {e.demanda}
                </p>
                {e.deleted_at && e.deleted_motivo && (
                  <p className="mt-1 text-xs text-slate-400">
                    Motivo do arquivamento: {e.deleted_motivo}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
