import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { criarEvolucao } from "../actions";
import { EvolucaoForm } from "../EvolucaoForm";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { anotacaoDaSessao } from "@/lib/prontuario/anotacoes";
import { registrarAcesso } from "@/lib/prontuario/acesso";
import { AnotacaoDaSessao } from "../AnotacaoDaSessao";

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
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const { data: paciente } = await supabase
    .from("pacientes")
    .select("id, nome")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!paciente) notFound();

  // Anotações para a sessão (0043): à mão na hora de escrever a evolução.
  const dataValida = data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : undefined;
  const anotacao =
    consulta || dataValida
      ? await anotacaoDaSessao(supabase, id, { consultaId: consulta, data: dataValida })
      : null;
  if (anotacao) await registrarAcesso(supabase, "anotacao", id);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <CabecalhoPagina
        titulo="Nova evolução"
        voltar={{ href: `/pacientes/${id}`, rotulo: <span data-sensivel>{paciente.nome}</span> }}
        descricao="Junto com a ficha e a anamnese do paciente, a evolução compõe o registro documental (Resolução CFP nº 01/2009)."
      />
      {anotacao && <AnotacaoDaSessao anotacao={anotacao} />}
      <EvolucaoForm
        action={criarEvolucao.bind(null, id)}
        consultaId={consulta}
        dataSessaoPadrao={
          data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : undefined
        }
        submitLabel="Registrar evolução"
        cancelHref={`/pacientes/${id}/evolucoes`}
      />
    </div>
  );
}
