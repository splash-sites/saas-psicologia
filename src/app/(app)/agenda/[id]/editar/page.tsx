import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import type { Consulta } from "@/lib/agenda/types";
import { dataChaveBR, horaBR } from "@/lib/agenda/datas";
import { atualizarConsulta } from "../../actions";
import { ConsultaEdicaoForm } from "../../ConsultaEdicaoForm";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";

export const metadata = { title: "Editar consulta" };

export default async function EditarConsultaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await usuarioAtual();
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
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <CabecalhoPagina titulo="Editar consulta" voltar={{ href: `/agenda/${id}`, rotulo: "Consulta" }} />
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
    </div>
  );
}
