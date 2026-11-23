import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Wallet } from "lucide-react";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { EstadoVazio } from "@/components/EstadoVazio";
import { NavegacaoPeriodo } from "@/components/NavegacaoPeriodo";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { hojeBR } from "@/lib/agenda/datas";
import {
  formatarBRL,
  statusExibicao,
  type Pagamento,
} from "@/lib/financeiro/types";
import { mesAtual, mesAnterior, mesSeguinte, primeiroDia, ultimoDia, rotuloMes } from "@/lib/financeiro/mes";
import { ListaLancamentos } from "./ListaLancamentos";
import { gerarLancamentosDasSessoes } from "@/lib/financeiro/gerar";

type EmAberto = { paciente_id: string; nome: string; quantidade: number; total: number; mais_antigo: string; atrasados: number };

export const metadata = { title: "Financeiro" };

type Linha = Pick<
  Pagamento,
  | "id"
  | "valor"
  | "status"
  | "data_referencia"
  | "vencimento"
  | "data_pagamento"
  | "forma_pagamento"
> & { pacientes: { nome: string } | null };

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes: mesParam } = await searchParams;
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const mes = /^\d{4}-\d{2}$/.test(mesParam ?? "") ? mesParam! : mesAtual();
  const inicio = primeiroDia(mes);
  const fim = ultimoDia(mes);
  const hoje = hojeBR();

  await gerarLancamentosDasSessoes(supabase);
  const mesCorrenteOuFuturo = mes >= mesAtual();

  const [{ data: doMes }, { data: recebidosNoMes }, { data: resumo }, { data: abertos }] = await Promise.all([
    supabase
      .from("pagamentos")
      .select(
        "id, valor, status, data_referencia, vencimento, data_pagamento, forma_pagamento, pacientes(nome)",
      )
      .is("deleted_at", null)
      .gte("data_referencia", inicio)
      .lte("data_referencia", fim)
      .order("data_referencia")
      .order("created_at"),
    supabase
      .from("pagamentos")
      .select("valor")
      .is("deleted_at", null)
      .eq("status", "pago")
      .gte("data_pagamento", inicio)
      .lte("data_pagamento", fim),
    mesCorrenteOuFuturo
      ? supabase.rpc("resumo_sessoes_mes", { p_inicio: inicio, p_fim: fim, p_agora: new Date().toISOString() })
      : Promise.resolve({ data: null }),
    supabase.rpc("em_aberto_por_paciente", { p_hoje: hoje }),
  ]);
  const previsto = (resumo as { previsto: number; sessoes_previstas: number }[] | null)?.[0] ?? null;
  const emAberto = (abertos ?? []) as EmAberto[];

  const lista = (doMes ?? []) as unknown as Linha[];
  const recebidoNoMes = (recebidosNoMes ?? []).reduce(
    (s, r) => s + Number(r.valor),
    0,
  );
  const aReceber = lista
    .filter((l) => l.status === "pendente")
    .reduce((s, l) => s + Number(l.valor), 0);
  const atrasados = lista.filter(
    (l) => statusExibicao(l, hoje) === "atrasado",
  ).length;

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <CabecalhoPagina
        titulo="Financeiro"
        periodo={
          <NavegacaoPeriodo
            anterior={{ href: `/financeiro?mes=${mesAnterior(mes)}`, rotulo: "Mês anterior" }}
            atual={{ href: "/financeiro", rotulo: "Este mês" }}
            proximo={{ href: `/financeiro?mes=${mesSeguinte(mes)}`, rotulo: "Próximo mês" }}
            periodo={rotuloMes(mes)}
          />
        }
        acoes={
          <>
            <Link href="/financeiro/historico" className="btn btn-outline">
              Histórico mensal
            </Link>
            <Link href="/financeiro/novo" className="btn btn-primary">
              <Plus className="size-4" aria-hidden />
              Novo lançamento
            </Link>
          </>
        }
      />

      <div className={`grid grid-cols-2 gap-3 ${previsto ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        <Tile rotulo="Recebido no mês" valor={formatarBRL(recebidoNoMes)} tom="green" />
        <Tile rotulo="A receber no mês" valor={formatarBRL(aReceber)} tom="amber" />
        {previsto && (
          <Tile
            rotulo={`Previsto até o fim do mês (${previsto.sessoes_previstas} ${previsto.sessoes_previstas === 1 ? "sessão" : "sessões"})`}
            valor={formatarBRL(Number(previsto.previsto))}
            tom="slate"
          />
        )}
        <Tile
          rotulo="Atrasados"
          valor={String(atrasados)}
          tom="red"
          className={previsto ? "" : "col-span-2 sm:col-span-1"}
        />
      </div>

      {emAberto.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-slate-700">Em aberto por paciente</h2>
          <ul className="divide-y rounded-lg border bg-white text-sm">
            {emAberto.map((a) => (
              <li key={a.paciente_id}>
                <Link
                  href={`/financeiro/em-aberto/${a.paciente_id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50"
                >
                  <span className="font-medium" data-sensivel>{a.nome}</span>
                  <span className="flex items-center gap-3 text-slate-600">
                    <span>
                      {a.quantidade} {a.quantidade === 1 ? "lançamento" : "lançamentos"}
                      {a.atrasados > 0 && <span className="text-red-700"> · {a.atrasados} atrasado{a.atrasados > 1 ? "s" : ""}</span>}
                    </span>
                    <span className="font-semibold text-slate-900" data-sensivel>{formatarBRL(Number(a.total))}</span>
                    <span className="text-teal-800">Ver e dar baixa</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lista.length === 0 ? (
        <EstadoVazio icon={Wallet} titulo="Nenhum lançamento neste mês">
          <Link href="/financeiro/novo" className="btn btn-primary">
            <Plus className="size-4" aria-hidden />
            Novo lançamento
          </Link>
        </EstadoVazio>
      ) : (
        <ListaLancamentos
          linhas={lista.map((l) => ({
            id: l.id,
            pacienteNome: l.pacientes?.nome ?? "Paciente",
            valor: Number(l.valor),
            vencimento: l.vencimento,
            formaPagamento: l.forma_pagamento,
            status: statusExibicao(l, hoje),
          }))}
        />
      )}
    </div>
  );
}

function Tile({
  rotulo,
  valor,
  tom,
  className = "",
}: {
  rotulo: string;
  valor: string;
  tom: "green" | "amber" | "red" | "slate";
  className?: string;
}) {
  const cores = {
    green: "border-green-200 bg-green-50 text-green-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
    slate: "border-slate-200 bg-white text-slate-700",
  }[tom];
  return (
    <div className={`card ${cores} ${className}`}>
      <div className="text-xs">{rotulo}</div>
      <div className="text-lg font-semibold" data-sensivel>
        {valor}
      </div>
    </div>
  );
}
