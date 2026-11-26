import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import type { Pagamento } from "@/lib/financeiro/types";
import { atualizarPagamento } from "../../actions";
import { PagamentoForm } from "../../PagamentoForm";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";

export const metadata = { title: "Editar lançamento" };

export default async function EditarPagamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const [{ data: pagamentoRow }, { data: pacientes }] = await Promise.all([
    supabase
      .from("pagamentos")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.from("pacientes").select("id, nome").is("deleted_at", null).order("nome"),
  ]);

  if (!pagamentoRow) notFound();

  // A sessão ligada aparece só para leitura (o vínculo não muda aqui).
  const { data: c } = pagamentoRow.consulta_id
    ? await supabase.from("consultas").select("id, inicio, pacientes(nome)").eq("id", pagamentoRow.consulta_id).maybeSingle()
    : { data: null };
  const pac = c ? (Array.isArray(c.pacientes) ? c.pacientes[0] : c.pacientes) : null;
  const sessao = c ? { id: c.id as string, inicio: c.inicio as string, pacienteNome: (pac as { nome: string } | null)?.nome ?? "Paciente" } : null;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <CabecalhoPagina titulo="Editar lançamento" voltar={{ href: `/financeiro/${id}`, rotulo: "Lançamento" }} />
      <PagamentoForm
        action={atualizarPagamento.bind(null, id)}
        pagamento={pagamentoRow as Pagamento}
        pacientes={(pacientes ?? []) as { id: string; nome: string }[]}
        consulta={sessao}
        submitLabel="Salvar alterações"
        cancelHref={`/financeiro/${id}`}
      />
    </div>
  );
}
