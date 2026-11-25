import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Plus, Wallet } from "lucide-react";
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
import { desarquivarPagamento } from "./actions";

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
  searchParams: Promise<{ mes?: string; arquivado?: string }>;
}) {
  const { mes: mesParam, arquivado } = await searchParams;
  // Acabou de arquivar um lançamento: oferece "Desfazer".
  const arquivadoId = arquivado && /^[0-9a-f-]{36}$/i.test(arquivado) ? arquivado : null;
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const mes = /^\d{4}-\d{2}$/.test(mesParam ?? "") ? mesParam! : mesAtual();
  const inicio = primeiroDia(mes);
  const fim = ultimoDia(mes);
  const hoje = hojeBR();

  await gerarLancamentosDasSessoes(supabase);
  const mesCorrenteOuFuturo = mes >= mesAtual();

  const [{ data: doMes }, { data: recebidosNoMes }, { data: resumo }] = await Promise.all([
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
  ]);
  const previsto =
    (resumo as { a_receber: number; previsto: number; sessoes_previstas: number }[] | null)?.[0] ?? null;

  const lista = (doMes ?? []) as unknown as Linha[];
  const recebidoNoMes = (recebidosNoMes ?? []).reduce(
    (s, r) => s + Number(r.valor),
    0,
  );
  // Mês atual ou futuro: só o que já aconteceu (o resto está no previsto, 0037).
  const aReceber = previsto
    ? Number(previsto.a_receber)
    : lista.filter((l) => l.status === "pendente").reduce((s, l) => s + Number(l.valor), 0);
  // Atrasados do mês: lançamentos deste mês pendentes e já vencidos.
  const atrasadosDoMes = lista.filter((l) => statusExibicao(l, hoje) === "atrasado");
  const valorAtrasadoMes = atrasadosDoMes.reduce((s, l) => s + Number(l.valor), 0);

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <CabecalhoPagina
        titulo="Financeiro"
        periodo={
          <NavegacaoPeriodo
            anterior={{ href: `/financeiro?mes=${mesAnterior(mes)}`, rotulo: "Mês anterior" }}
            atual={{ href: "/financeiro", rotulo: "Mês atual" }}
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

      {arquivadoId && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-[#DDE6E3] bg-[#EEF2F1] px-3.5 py-2.5 text-sm font-semibold text-[#3D524D]">
          Lançamento arquivado. Ele não aparece mais nas listas nem nos totais.
          <form action={desarquivarPagamento.bind(null, arquivadoId)}>
            <button className="min-h-9 rounded-lg border border-[#C9D6D2] bg-white px-3 text-[13px] font-semibold text-[#12302B] hover:bg-[#F2FAF8]">
              Desfazer
            </button>
          </form>
        </div>
      )}

      <div className={`grid grid-cols-2 gap-3 ${previsto ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        <Tile rotulo="Recebido no mês" valor={formatarBRL(recebidoNoMes)} tom="green" />
        <Tile
          rotulo={previsto ? "A receber (sessões realizadas)" : "A receber no mês"}
          valor={formatarBRL(aReceber)}
          tom="amber"
          href={`/financeiro/a-receber?mes=${mes}`}
        />
        {previsto && (
          <Tile
            rotulo={`Previsto até o fim do mês (${previsto.sessoes_previstas} ${previsto.sessoes_previstas === 1 ? "sessão" : "sessões"})`}
            valor={formatarBRL(Number(previsto.previsto))}
            tom="slate"
            href={`/financeiro/previsto?mes=${mes}`}
          />
        )}
        <Tile
          rotulo={`Atrasados do mês${atrasadosDoMes.length ? ` (${atrasadosDoMes.length})` : ""}`}
          valor={formatarBRL(valorAtrasadoMes)}
          tom="red"
          className={previsto ? "" : "col-span-2 sm:col-span-1"}
          href={atrasadosDoMes.length ? `/financeiro/a-receber?mes=${mes}&atrasados=1` : undefined}
        />
      </div>

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
  href,
}: {
  rotulo: string;
  valor: string;
  tom: "green" | "amber" | "red" | "slate";
  className?: string;
  /** Card clicável: abre o detalhe. */
  href?: string;
}) {
  const cores = {
    green: "border-green-200 bg-green-50 text-green-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
    slate: "border-slate-200 bg-white text-slate-700",
  }[tom];
  const conteudo = (
    <>
      <div className="text-xs">{rotulo}</div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-lg font-semibold" data-sensivel>
          {valor}
        </span>
        {href && <ChevronRight className="size-4 shrink-0 opacity-60" aria-hidden />}
      </div>
    </>
  );
  return href ? (
    <Link href={href} className={`card ${cores} ${className} transition hover:shadow-md hover:brightness-[0.98]`}>
      {conteudo}
    </Link>
  ) : (
    <div className={`card ${cores} ${className}`}>{conteudo}</div>
  );
}
