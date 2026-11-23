import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { hojeBR } from "@/lib/agenda/datas";
import { formatarCpf } from "@/lib/pacientes/formatacao";
import { gerarLancamentosDasSessoes } from "@/lib/financeiro/gerar";
import { marcarVariosComoPagos } from "../../actions";
import { BaixaEmLoteForm, type LinhaAberta } from "./BaixaEmLoteForm";

export const metadata = { title: "Em aberto" };

const UUID_RE = /^[0-9a-f-]{36}$/i;

export default async function EmAbertoPaciente({
  params,
  searchParams,
}: {
  params: Promise<{ pacienteId: string }>;
  searchParams: Promise<{ baixa?: string }>;
}) {
  const { pacienteId } = await params;
  const { baixa } = await searchParams;
  if (!UUID_RE.test(pacienteId)) notFound();
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  await gerarLancamentosDasSessoes(supabase);
  const [{ data: paciente }, { data: pendentes }] = await Promise.all([
    supabase
      .from("pacientes")
      .select("id, nome, cpf, responsavel_nome, responsavel_cpf, responsavel_relacao")
      .eq("id", pacienteId)
      .maybeSingle(),
    supabase
      .from("pagamentos")
      .select("id, valor, data_referencia, vencimento, origem, consulta_id")
      .eq("paciente_id", pacienteId)
      .eq("status", "pendente")
      .is("deleted_at", null)
      .order("data_referencia")
      .limit(500),
  ]);
  if (!paciente) notFound();

  const hoje = hojeBR();
  const linhas: LinhaAberta[] = (pendentes ?? []).map((p) => ({
    id: p.id as string,
    valor: Number(p.valor),
    dataReferencia: p.data_referencia as string,
    vencimento: p.vencimento as string,
    atrasado: (p.vencimento as string) < hoje,
    sessao: p.origem === "sessao",
  }));
  const cpf = (v: string | null) => (v ? `CPF ${formatarCpf(v)}` : "sem CPF cadastrado");

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <CabecalhoPagina
        titulo={<span data-sensivel>{paciente.nome}</span>}
        voltar={{ href: "/financeiro", rotulo: "Financeiro" }}
        descricao="Lançamentos em aberto, de todos os meses. Marque os que foram pagos e dê baixa de uma vez."
      />

      {baixa && (
        <p className="alert alert-success" role="status">
          Baixa feita em {baixa} {baixa === "1" ? "lançamento" : "lançamentos"}.
        </p>
      )}

      <section className="flex flex-col gap-1 rounded-lg bg-slate-50 px-4 py-3 text-sm">
        <span className="text-xs text-slate-500">Dados para o recibo</span>
        {paciente.responsavel_nome ? (
          <>
            <span data-sensivel>
              Pago por: <span className="font-medium">{paciente.responsavel_nome}</span>
              {paciente.responsavel_relacao && ` (${paciente.responsavel_relacao})`} · {cpf(paciente.responsavel_cpf)}
            </span>
            <span data-sensivel>Paciente: {paciente.nome} · {cpf(paciente.cpf)}</span>
          </>
        ) : (
          <span data-sensivel>
            Pago pelo próprio paciente · {cpf(paciente.cpf)}
          </span>
        )}
      </section>

      {linhas.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nada em aberto para este paciente.{" "}
          <Link href="/financeiro" className="text-teal-800 hover:opacity-80">
            Voltar ao Financeiro
          </Link>
        </p>
      ) : (
        <BaixaEmLoteForm action={marcarVariosComoPagos.bind(null, pacienteId)} linhas={linhas} />
      )}
    </div>
  );
}
