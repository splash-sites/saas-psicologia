import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { criarPagamento } from "../actions";
import { PagamentoForm } from "../PagamentoForm";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";

export const metadata = { title: "Novo lançamento" };

export default async function NovoPagamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ paciente?: string; consulta?: string; data?: string }>;
}) {
  const { paciente, consulta, data } = await searchParams;
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const { data: pacientes } = await supabase.from("pacientes").select("id, nome").is("deleted_at", null).order("nome");

  const lista = (pacientes ?? []) as { id: string; nome: string }[];

  // Valor sugerido: o da consulta, ou o valor da sessão do paciente.
  const uuid = /^[0-9a-f-]{36}$/i;
  let valorPadrao: number | null = null;
  // Vindo do painel da consulta ("lançar agora", sessão sem cobrança): a
  // sessão aparece só para leitura. Sem ?consulta=, é lançamento avulso.
  let sessao: { id: string; inicio: string; pacienteNome: string } | null = null;
  let pacienteDaSessao: string | undefined;
  if (consulta && uuid.test(consulta)) {
    const { data: c } = await supabase
      .from("consultas")
      .select("id, inicio, valor, paciente_id, pacientes(nome)")
      .eq("id", consulta)
      .is("deleted_at", null)
      .maybeSingle();
    if (c) {
      const pac = Array.isArray(c.pacientes) ? c.pacientes[0] : c.pacientes;
      sessao = { id: c.id as string, inicio: c.inicio as string, pacienteNome: (pac as { nome: string } | null)?.nome ?? "Paciente" };
      pacienteDaSessao = c.paciente_id as string;
      valorPadrao = c.valor == null ? null : Number(c.valor);
    }
  }
  if (valorPadrao === null && paciente && uuid.test(paciente)) {
    const { data: p } = await supabase.from("pacientes").select("valor_sessao").eq("id", paciente).maybeSingle();
    valorPadrao = p?.valor_sessao == null ? null : Number(p.valor_sessao);
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <CabecalhoPagina titulo="Novo lançamento" voltar={{ href: "/financeiro", rotulo: "Financeiro" }} />
      {lista.length === 0 ? (
        <p className="text-sm text-slate-500">
          Cadastre um paciente antes de lançar um pagamento.{" "}
          <Link href="/pacientes/novo" className="font-medium text-teal-700 hover:text-teal-800">
            Novo paciente
          </Link>
        </p>
      ) : (
        <PagamentoForm
          action={criarPagamento}
          pacientes={lista}
          consulta={sessao}
          pacienteIdPadrao={pacienteDaSessao ?? paciente}
          dataPadrao={data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : undefined}
          valorPadrao={valorPadrao}
          submitLabel="Lançar"
          cancelHref="/financeiro"
        />
      )}
    </div>
  );
}
