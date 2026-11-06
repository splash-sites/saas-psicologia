import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { consultasDisponiveis } from "@/lib/financeiro/consultasDisponiveis";
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

  const [{ data: pacientes }, consultas] = await Promise.all([
    supabase.from("pacientes").select("id, nome").is("deleted_at", null).order("nome"),
    consultasDisponiveis(supabase),
  ]);

  const lista = (pacientes ?? []) as { id: string; nome: string }[];

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
          consultas={consultas}
          pacienteIdPadrao={paciente}
          consultaIdPadrao={consulta}
          dataPadrao={data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : undefined}
          submitLabel="Lançar"
          cancelHref="/financeiro"
        />
      )}
    </div>
  );
}
