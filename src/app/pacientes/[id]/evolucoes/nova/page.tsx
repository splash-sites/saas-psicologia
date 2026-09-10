import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { criarEvolucao } from "../actions";
import { EvolucaoForm } from "../EvolucaoForm";

export const metadata = { title: "Nova evolução" };

export default async function NovaEvolucaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ consulta?: string; data?: string }>;
}) {
  const { id } = await params;
  const { consulta, data } = await searchParams;

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

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-xl font-semibold">
        Nova evolução — {paciente.nome}
      </h1>
      <p className="text-sm text-gray-500">
        Registro documental da sessão (Resolução CFP 01/2009). Os quatro campos
        são obrigatórios.
      </p>
      <EvolucaoForm
        action={criarEvolucao.bind(null, id)}
        consultaId={consulta}
        dataSessaoPadrao={
          data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : undefined
        }
        submitLabel="Registrar evolução"
        cancelHref={`/pacientes/${id}/evolucoes`}
      />
    </main>
  );
}
