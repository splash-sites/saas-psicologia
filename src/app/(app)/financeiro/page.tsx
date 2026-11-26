import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Plus, Wallet } from "lucide-react";
import { situacaoLancamento } from "@/lib/financeiro/situacao";
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
import { TopoCelular } from "./TopoCelular";

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
> & {
  paciente_id: string;
  pacientes: { nome: string } | null;
  consultas: { fim: string; modalidade: string } | { fim: string; modalidade: string }[] | null;
};

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
  const nomeMes = rotuloMes(mes).split(" de ")[0].toLowerCase();

  const [{ data: doMes }, { data: recebidosNoMes }, { data: resumo }] = await Promise.all([
    supabase
      .from("pagamentos")
      .select(
        "id, paciente_id, valor, status, data_referencia, vencimento, data_pagamento, forma_pagamento, pacientes(nome), consultas(fim, modalidade)",
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
  // Sessões a receber (já aconteceram), para a contagem embaixo do valor: mesma
  // regra do resumo_sessoes_mes (0037).
  const agora = new Date().getTime();
  const consultaDe = (l: Linha) => (Array.isArray(l.consultas) ? (l.consultas[0] ?? null) : l.consultas);
  const realizado = (l: Linha) => {
    const c = consultaDe(l);
    return c ? new Date(c.fim).getTime() <= agora : l.data_referencia <= hoje;
  };
  const nAReceber = lista.filter((l) => l.status === "pendente" && (!previsto || realizado(l))).length;
  const n = (x: number, um: string, varios: string) => `${x} ${x === 1 ? um : varios}`;

  return (
    <div className="flex w-full max-w-5xl flex-col gap-5 text-[#12302B]">
      <TopoCelular
        titulo="Financeiro"
        periodo={rotuloMes(mes)}
        anteriorHref={`/financeiro?mes=${mesAnterior(mes)}`}
        proximoHref={`/financeiro?mes=${mesSeguinte(mes)}`}
        mesAtualHref={mes === mesAtual() ? null : "/financeiro"}
        novo
      />
      <div className="hidden md:block">
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
      </div>

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

      {/* Resumo do mês (canvas Financeiro) */}
      {/* Três números, decisão do usuário (2026-11-25): quanto já entrou, o que
          já aconteceu e não foi pago, e o que ainda vem das sessões marcadas.
          O atraso fica na aba "Atrasados" e no "Só atrasados" do A receber. */}
      <section aria-label="Resumo do mês" className={`grid grid-cols-2 gap-2.5 ${previsto ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        <div className="col-span-2 flex flex-col gap-1 rounded-2xl bg-[#12302B] px-5 py-4 text-[#F4F7F6] lg:col-span-1">
          <span className="text-[13px] text-[#C9DAD5]">Recebido em {nomeMes}</span>
          <span className="text-[28px] font-bold tracking-tight" data-sensivel>
            {formatarBRL(recebidoNoMes)}
          </span>
          <span className="text-[13px] text-[#C9DAD5]">{n(recebidosNoMes?.length ?? 0, "pagamento", "pagamentos")}</span>
        </div>
        <Tile
          rotulo={previsto ? "A receber" : "A receber no mês"}
          valor={formatarBRL(aReceber)}
          sub={previsto ? `${n(nAReceber, "sessão realizada", "sessões realizadas")}, não pagas` : n(nAReceber, "lançamento", "lançamentos")}
          href={`/financeiro/a-receber?mes=${mes}`}
          className={previsto ? "" : "col-span-2 lg:col-span-1"}
        />
        {previsto && (
          <Tile
            rotulo="Previsto até o fim do mês"
            valor={formatarBRL(Number(previsto.previsto))}
            sub={n(previsto.sessoes_previstas, "sessão marcada", "sessões marcadas")}
            href={`/financeiro/previsto?mes=${mes}`}
          />
        )}
      </section>

      {lista.length === 0 ? (
        <EstadoVazio icon={Wallet} titulo="Nenhum lançamento neste mês">
          <Link href="/financeiro/novo" className="btn btn-primary">
            <Plus className="size-4" aria-hidden />
            Novo lançamento
          </Link>
          <Link href="/financeiro/historico" className="btn btn-outline md:hidden">
            Ver histórico mensal
          </Link>
        </EstadoVazio>
      ) : (
        <>
          <ListaLancamentos
            hoje={hoje}
            linhas={lista.map((l) => {
              const c = consultaDe(l);
              return {
                id: l.id,
                pacienteId: l.paciente_id,
                pacienteNome: l.pacientes?.nome ?? "Paciente",
                valor: Number(l.valor),
                data: l.data_referencia,
                referente: c ? `Sessão ${c.modalidade === "online" ? "online" : "presencial"}` : "Lançamento",
                online: c?.modalidade === "online",
                pago: l.status === "pago",
                atrasado: statusExibicao(l, hoje) === "atrasado",
                situacao: situacaoLancamento(l, hoje),
                formaPagamento: l.forma_pagamento,
              };
            })}
          />
          <Link href="/financeiro/historico" className="self-center text-sm font-semibold text-[#0F766E] hover:text-[#12302B] lg:hidden">
            Ver histórico mensal
          </Link>
        </>
      )}
    </div>
  );
}

function Tile({
  rotulo,
  valor,
  sub,
  className = "",
  href,
}: {
  rotulo: string;
  valor: string;
  sub: string;
  className?: string;
  /** Card clicável: abre o detalhe. */
  href?: string;
}) {
  const conteudo = (
    <>
      <span className="flex items-center justify-between gap-2 text-[13px] text-[#4A5F5A]">
        {rotulo}
        {href && <ChevronRight className="size-4 shrink-0 text-[#0F766E]" aria-hidden />}
      </span>
      <span className="text-xl font-bold" data-sensivel>
        {valor}
      </span>
      <span className={`text-[13px] ${href ? "text-[#0F766E]" : "text-[#4A5F5A]"}`}>{sub}</span>
    </>
  );
  const classe = `flex flex-col gap-1 rounded-2xl border border-[#DFEBE7] bg-white px-4 py-3.5 ${className}`;
  return href ? (
    <Link href={href} className={`${classe} transition hover:border-[#0F766E] hover:shadow-sm`}>
      {conteudo}
    </Link>
  ) : (
    <div className={classe}>{conteudo}</div>
  );
}
