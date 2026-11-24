import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { EstadoVazio } from "@/components/EstadoVazio";
import { NavegacaoPeriodo } from "@/components/NavegacaoPeriodo";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { hojeBR } from "@/lib/agenda/datas";
import { formatarBRL } from "@/lib/financeiro/types";
import { mesAtual, mesAnterior, mesSeguinte, primeiroDia, ultimoDia, rotuloMes } from "@/lib/financeiro/mes";
import { gerarLancamentosDasSessoes } from "@/lib/financeiro/gerar";

export const metadata = { title: "A receber" };

// Detalhe do card "A receber (sessões realizadas)" (2026-11-24, decisão do
// usuário): o que já aconteceu e não foi pago, por paciente — deste mês (mesma
// regra do card, resumo_sessoes_mes da 0037) e, separado, de meses anteriores.
// "Dar baixa" abre a baixa em lote do paciente.

type Pendente = {
  id: string;
  paciente_id: string;
  valor: number;
  data_referencia: string;
  vencimento: string;
  consultas: { fim: string } | { fim: string }[] | null;
  pacientes: { nome: string } | { nome: string }[] | null;
};
type Grupo = { pacienteId: string; nome: string; itens: Pendente[]; total: number; atrasados: number };

const um = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

function agrupar(itens: Pendente[], hoje: string): Grupo[] {
  const porPaciente = new Map<string, Grupo>();
  for (const p of itens) {
    const g = porPaciente.get(p.paciente_id) ?? {
      pacienteId: p.paciente_id,
      nome: um(p.pacientes)?.nome ?? "Paciente",
      itens: [],
      total: 0,
      atrasados: 0,
    };
    g.itens.push(p);
    g.total += Number(p.valor);
    if (p.vencimento < hoje) g.atrasados++;
    porPaciente.set(p.paciente_id, g);
  }
  return [...porPaciente.values()].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
}

export default async function AReceberPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes: mesParam } = await searchParams;
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const mes = /^\d{4}-\d{2}$/.test(mesParam ?? "") ? mesParam! : mesAtual();
  const inicio = primeiroDia(mes);
  const fim = ultimoDia(mes);
  const hoje = hojeBR();
  const agora = new Date().getTime();

  await gerarLancamentosDasSessoes(supabase);
  const { data } = await supabase
    .from("pagamentos")
    .select("id, paciente_id, valor, data_referencia, vencimento, consultas(fim), pacientes(nome)")
    .eq("status", "pendente")
    .is("deleted_at", null)
    .lte("data_referencia", fim)
    .order("data_referencia")
    .limit(1000);

  // Já aconteceu: sessão terminada, ou lançamento sem sessão com data até hoje.
  const realizado = (p: Pendente) => {
    const c = um(p.consultas);
    return c ? new Date(c.fim).getTime() <= agora : p.data_referencia <= hoje;
  };
  const todos = ((data ?? []) as unknown as Pendente[]).filter(realizado);
  const desteMes = agrupar(todos.filter((p) => p.data_referencia >= inicio), hoje);
  const anteriores = agrupar(todos.filter((p) => p.data_referencia < inicio), hoje);
  const soma = (gs: Grupo[]) => gs.reduce((s, g) => s + g.total, 0);

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <CabecalhoPagina
        titulo="A receber"
        voltar={{ href: `/financeiro?mes=${mes}`, rotulo: "Financeiro" }}
        periodo={
          <NavegacaoPeriodo
            anterior={{ href: `/financeiro/a-receber?mes=${mesAnterior(mes)}`, rotulo: "Mês anterior" }}
            atual={{ href: "/financeiro/a-receber", rotulo: "Este mês" }}
            proximo={{ href: `/financeiro/a-receber?mes=${mesSeguinte(mes)}`, rotulo: "Próximo mês" }}
            periodo={rotuloMes(mes)}
          />
        }
        descricao="Sessões que já aconteceram e ainda não foram pagas. Em cada paciente, “Dar baixa” marca várias como pagas de uma vez."
      />

      {desteMes.length === 0 && anteriores.length === 0 ? (
        <EstadoVazio icon={CheckCheck} titulo="Nada a receber" texto="Todas as sessões realizadas estão pagas." />
      ) : (
        <>
          <Secao titulo={`De ${rotuloMes(mes).toLowerCase()}`} grupos={desteMes} total={soma(desteMes)} hoje={hoje} vazio="Nada a receber deste mês." />
          {anteriores.length > 0 && (
            <Secao titulo="De meses anteriores" grupos={anteriores} total={soma(anteriores)} hoje={hoje} destaque />
          )}
        </>
      )}
    </div>
  );
}

function Secao({
  titulo,
  grupos,
  total,
  hoje,
  vazio,
  destaque,
}: {
  titulo: string;
  grupos: Grupo[];
  total: number;
  hoje: string;
  vazio?: string;
  destaque?: boolean;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={`text-sm font-semibold ${destaque ? "text-red-800" : "text-slate-700"}`}>{titulo}</h2>
        {grupos.length > 0 && (
          <span className="text-sm font-semibold text-slate-900" data-sensivel>
            {formatarBRL(total)}
          </span>
        )}
      </div>
      {grupos.length === 0 ? (
        <p className="text-sm text-slate-500">{vazio}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {grupos.map((g) => (
            <li key={g.pacienteId} className="card flex flex-col gap-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium" data-sensivel>
                  {g.nome}
                </span>
                <span className="flex items-center gap-3 text-sm">
                  <span className="text-slate-600">
                    {g.itens.length} {g.itens.length === 1 ? "sessão" : "sessões"}
                    {g.atrasados > 0 && <span className="text-red-700"> · {g.atrasados} atrasada{g.atrasados > 1 ? "s" : ""}</span>}
                  </span>
                  <span className="font-semibold" data-sensivel>
                    {formatarBRL(g.total)}
                  </span>
                  <Link href={`/financeiro/em-aberto/${g.pacienteId}`} className="btn btn-outline btn-sm">
                    Dar baixa
                  </Link>
                </span>
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                {g.itens.map((p) => (
                  <li key={p.id}>
                    <Link href={`/financeiro/${p.id}`} className="hover:text-teal-800">
                      {dm(p.data_referencia)} · <span data-sensivel>{formatarBRL(Number(p.valor))}</span>
                      {p.vencimento < hoje && <span className="text-red-700"> · venceu {dm(p.vencimento)}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
