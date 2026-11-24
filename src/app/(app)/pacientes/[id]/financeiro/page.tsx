import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import type { Paciente } from "@/lib/pacientes/types";
import { resumoDoPaciente } from "@/lib/pacientes/resumo";
import { gerarLancamentosDasSessoes } from "@/lib/financeiro/gerar";
import { FinanceiroPaciente } from "../ResumoPaciente";

export const metadata = { title: "Financeiro do paciente" };

// "Ver todos" do financeiro da ficha: todos os lançamentos do paciente.
export default async function FinanceiroDoPaciente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const { data } = await supabase.from("pacientes").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!data) notFound();
  const paciente = data as Paciente;
  await gerarLancamentosDasSessoes(supabase);
  const resumo = await resumoDoPaciente(supabase, id);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <CabecalhoPagina
        titulo="Financeiro"
        voltar={{ href: `/pacientes/${id}`, rotulo: <span data-sensivel>{paciente.nome}</span> }}
        descricao="Todos os lançamentos deste paciente, do mais recente para o mais antigo."
      />
      <FinanceiroPaciente paciente={paciente} r={resumo} verTodos={false} />
    </div>
  );
}
