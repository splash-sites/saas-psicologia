import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <Link
        href={`/pacientes/${id}`}
        className="text-sm text-gray-500 hover:underline"
      >
        ← {paciente.nome}
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          Evoluções {mostrarArquivadas && "arquivadas"}
        </h1>
        {!mostrarArquivadas && (
          <Link
            href={`/pacientes/${id}/evolucoes/nova`}
            className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-black/80"
          >
            Nova evolução
          </Link>
        )}
      </div>

      <nav className="flex gap-3 text-sm">
        <Link
          href={`/pacientes/${id}/evolucoes`}
          className={!mostrarArquivadas ? "font-medium underline" : "text-gray-500"}
        >
          Ativas
        </Link>
        <Link
          href={`/pacientes/${id}/evolucoes?arquivadas=1`}
          className={mostrarArquivadas ? "font-medium underline" : "text-gray-500"}
        >
          Arquivadas
        </Link>
      </nav>

      {lista.length === 0 ? (
        <p className="text-sm text-gray-500">
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
                className="block rounded-lg border p-4 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    Sessão de {dataBR(e.data_sessao)}
                  </span>
                  {e.deleted_at && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      Arquivada
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                  {e.demanda}
                </p>
                {e.deleted_at && e.deleted_motivo && (
                  <p className="mt-1 text-xs text-gray-400">
                    Motivo do arquivamento: {e.deleted_motivo}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
