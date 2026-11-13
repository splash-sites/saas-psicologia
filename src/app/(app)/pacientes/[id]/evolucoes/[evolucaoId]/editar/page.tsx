import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import type { Evolucao } from "@/lib/prontuario/types";
import { atualizarEvolucao } from "../../actions";
import { EvolucaoForm } from "../../EvolucaoForm";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { registrarAcesso } from "@/lib/prontuario/acesso";

export const metadata = { title: "Editar evolução" };

export default async function EditarEvolucaoPage({
  params,
}: {
  params: Promise<{ id: string; evolucaoId: string }>;
}) {
  const { id, evolucaoId } = await params;
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("evolucoes")
    .select("*")
    .eq("id", evolucaoId)
    .eq("paciente_id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) notFound();
  await registrarAcesso(supabase, "evolucao", id, evolucaoId);
  const evolucao = data as Evolucao;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <CabecalhoPagina titulo="Editar evolução" voltar={{ href: `/pacientes/${id}/evolucoes/${evolucaoId}`, rotulo: "Evolução" }} />
      <EvolucaoForm
        action={atualizarEvolucao.bind(null, id, evolucaoId)}
        evolucao={evolucao}
        submitLabel="Salvar alterações"
        cancelHref={`/pacientes/${id}/evolucoes/${evolucaoId}`}
      />
    </div>
  );
}
