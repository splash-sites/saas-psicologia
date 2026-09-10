import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Consulta } from "@/lib/agenda/types";
import { dataChaveBR, horaBR } from "@/lib/agenda/datas";
import { atualizarConsulta } from "../../actions";
import { ConsultaEdicaoForm } from "../../ConsultaEdicaoForm";

export const metadata = { title: "Editar consulta" };

export default async function EditarConsultaPage({
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
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) notFound();
  const c = data as Consulta;
  const duracao = Math.round(
    (new Date(c.fim).getTime() - new Date(c.inicio).getTime()) / 60000,
  );

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-xl font-semibold">Editar consulta</h1>
      <ConsultaEdicaoForm
        action={atualizarConsulta.bind(null, id)}
        cancelHref={`/agenda/${id}`}
        defaults={{
          data: dataChaveBR(c.inicio),
          hora: horaBR(c.inicio),
          duracao_min: duracao,
          modalidade: c.modalidade,
          status: c.status,
          observacoes: c.observacoes,
        }}
      />
    </main>
  );
}
