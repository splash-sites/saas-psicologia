import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { hojeBR } from "@/lib/agenda/datas";
import { formatarBRL, rotuloFormaPagamento, type Pagamento } from "@/lib/financeiro/types";
import { diasEntre, idade, situacaoLancamento, tomDoAtraso, CLASSE_TOM } from "@/lib/financeiro/situacao";
import { corAvatar, iniciais } from "@/lib/pacientes/avatar";
import type { Paciente } from "@/lib/pacientes/types";
import { MODALIDADE_LABEL, type ConsultaStatus, type Modalidade } from "@/lib/agenda/types";
import { marcarComoPago, desmarcarComoPago, arquivarPagamento, desfazerBaixa } from "../actions";
import { Pilula } from "../Pilula";
import { DarBaixa } from "./DarBaixa";
import { AcoesLancamento } from "./AcoesLancamento";
import { CpfRecibo } from "./CpfRecibo";

// Detalhe do lançamento (redesenho de 2026-11-25, canvas "Lançamento" do
// usuário): valor e situação no topo, dados, linha do tempo (sessão →
// vencimento → pagamento), "Dar baixa" com data e forma, menu "⋯" (desmarcar,
// arquivar com confirmação), dados para o recibo com o CPF mascarado.

type PacienteDoLancamento = Pick<
  Paciente,
  "id" | "nome" | "cpf" | "responsavel_nome" | "responsavel_cpf" | "responsavel_relacao"
>;
type ConsultaDoLancamento = { id: string; inicio: string; fim: string; modalidade: Modalidade; status: ConsultaStatus };
type Row = Pagamento & {
  pacientes: PacienteDoLancamento | null;
  consultas: ConsultaDoLancamento | ConsultaDoLancamento[] | null;
};

const dataBR = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const FMT_HORA = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const FMT_DIA = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
const quandoSessao = (iso: string) => `${dataBR(FMT_DIA.format(new Date(iso)))}, ${FMT_HORA.format(new Date(iso))}`;

export default async function PagamentoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ baixa?: string }>;
}) {
  const { id } = await params;
  const { baixa } = await searchParams;
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("pagamentos")
    .select(
      "*, pacientes(id, nome, cpf, responsavel_nome, responsavel_cpf, responsavel_relacao), consultas(id, inicio, fim, modalidade, status)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) notFound();
  const p = data as unknown as Row;
  const consulta = Array.isArray(p.consultas) ? (p.consultas[0] ?? null) : p.consultas;
  const hoje = hojeBR();
  const agora = new Date().getTime();
  const situacao = situacaoLancamento(p, hoje);
  const pago = p.status === "pago";
  const forma = rotuloFormaPagamento(p.forma_pagamento);
  const pac = p.pacientes;

  // Linha do tempo: origem → vencimento → pagamento.
  const sessaoPassou = consulta ? new Date(consulta.fim).getTime() <= agora : p.data_referencia <= hoje;
  const origem = consulta
    ? {
        titulo:
          consulta.status === "cancelada"
            ? "Sessão cancelada"
            : consulta.status === "falta"
              ? "Falta"
              : sessaoPassou
                ? "Sessão realizada"
                : "Sessão marcada",
        sub: `${quandoSessao(consulta.inicio)} · ${MODALIDADE_LABEL[consulta.modalidade].toLowerCase()}`,
        feito: sessaoPassou,
      }
    : { titulo: "Lançamento", sub: `Referente a ${dataBR(p.data_referencia)}`, feito: sessaoPassou };
  const atraso = pago ? 0 : p.vencimento < hoje ? diasEntre(p.vencimento, hoje) : 0;
  const ficouEmAberto = pago && p.data_pagamento && p.data_pagamento > p.vencimento ? diasEntre(p.vencimento, p.data_pagamento) : 0;
  const vencimento = pago
    ? ficouEmAberto > 0
      ? { titulo: "Ficou em aberto", sub: idade(ficouEmAberto), estado: "feito" as const }
      : { titulo: "Vencimento", sub: dataBR(p.vencimento), estado: "feito" as const }
    : atraso > 0
      ? { titulo: "Atrasado", sub: `há ${idade(atraso)} · venceu ${dataBR(p.vencimento)}`, estado: "atual" as const }
      : { titulo: p.vencimento === hoje ? "Vence hoje" : "Vence em", sub: dataBR(p.vencimento), estado: "futuro" as const };
  const pagamentoTxt = pago ? `${dataBR(p.data_pagamento)}${forma ? ` · ${forma}` : ""}` : "Ainda não registrado";

  return (
    <div className="flex w-full max-w-3xl flex-col gap-4 text-[#12302B]">
      <Link href="/financeiro" className="inline-flex w-fit items-center gap-1 text-sm font-medium text-[#3D524D] hover:text-[#12302B]">
        <ChevronLeft className="size-4" aria-hidden />
        Financeiro
      </Link>

      {baixa !== undefined && pago && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-[#BFE6D6] bg-[#ECF8F3] px-3.5 py-2.5 text-sm font-semibold text-[#0B5A54]">
          <span className="flex items-center gap-2">
            <Check className="size-4" aria-hidden />
            Baixa registrada.
          </span>
          <form action={desfazerBaixa.bind(null, id, baixa)}>
            <button className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#BFE6D6] bg-white px-3 text-[13px] font-semibold text-[#0B5A54] hover:bg-[#F2FAF8]">
              <RotateCcw className="size-3.5" aria-hidden />
              Desfazer
            </button>
          </form>
        </div>
      )}

      {/* Valor, situação, paciente e ações */}
      <section className="flex flex-col gap-4 rounded-2xl border border-[#DFEBE7] bg-white p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <h1 className="text-[32px] font-bold leading-none tracking-tight" data-sensivel>
              {formatarBRL(p.valor)}
            </h1>
            <Pilula situacao={situacao} grande />
          </div>
          <AcoesLancamento
            editarHref={`/financeiro/${id}/editar`}
            desmarcar={pago ? desmarcarComoPago.bind(null, id) : undefined}
            arquivar={arquivarPagamento.bind(null, id)}
          />
        </div>
        {pac && (
          <Link href={`/pacientes/${pac.id}`} className="flex min-h-11 w-fit items-center gap-2.5 hover:opacity-80">
            <span aria-hidden className={`flex size-9 items-center justify-center rounded-full text-xs font-bold ${corAvatar(pac.id)}`} data-sensivel>
              {iniciais(pac.nome)}
            </span>
            <span className="text-base font-semibold" data-sensivel>
              {pac.nome}
            </span>
            <ChevronRight className="size-4 text-[#0F766E]" aria-hidden />
          </Link>
        )}
        {!pago && <DarBaixa action={marcarComoPago.bind(null, id)} formaPadrao={p.forma_pagamento} />}
      </section>

      {/* Dados */}
      <section className="flex flex-col gap-3 rounded-2xl border border-[#DFEBE7] bg-white p-5 text-sm sm:p-6">
        <Dado rotulo="Referente a">
          {consulta ? `Sessão de ${quandoSessao(consulta.inicio)}` : dataBR(p.data_referencia)}
          {consulta && (
            <Link href={`/agenda?consulta=${consulta.id}`} className="ml-2 inline-flex items-center gap-0.5 font-semibold text-[#0F766E] hover:text-[#12302B]">
              Ver consulta
              <ChevronRight className="size-3.5" aria-hidden />
            </Link>
          )}
        </Dado>
        {consulta && <Dado rotulo="Modalidade">{MODALIDADE_LABEL[consulta.modalidade]}</Dado>}
        <Dado rotulo="Vencimento">{dataBR(p.vencimento)}</Dado>
        <Dado rotulo="Pagamento" fraco={!pago}>
          {pagamentoTxt}
        </Dado>
      </section>

      {/* Linha do tempo */}
      <section aria-label="Linha do tempo" className="flex flex-col gap-3 rounded-2xl border border-[#DFEBE7] bg-white p-5 sm:p-6">
        <h2 className="text-base font-bold">Linha do tempo</h2>
        <ol className="flex flex-col">
          <Passo estado={origem.feito ? "feito" : "futuro"} titulo={origem.titulo} sub={origem.sub} />
          <Passo
            estado={vencimento.estado}
            titulo={vencimento.titulo}
            sub={vencimento.sub}
            tomAtraso={atraso > 0 ? CLASSE_TOM[tomDoAtraso(atraso)] : undefined}
          />
          <Passo estado={pago ? "feito" : "futuro"} titulo={pago ? "Pago" : "Pagamento"} sub={pagamentoTxt} ultimo />
        </ol>
      </section>

      {/* Dados para o recibo (Receita Saúde): pagador e paciente com CPF */}
      {pac && (
        <section aria-label="Dados para o recibo" className="flex flex-col gap-2 rounded-2xl border border-[#DFEBE7] bg-white p-5 text-sm text-[#3D524D] sm:p-6">
          <h2 className="text-base font-bold text-[#12302B]">Dados para o recibo</h2>
          {pac.responsavel_nome ? (
            <>
              <Pessoa
                rotulo="Pago por"
                nome={`${pac.responsavel_nome}${pac.responsavel_relacao ? ` (${pac.responsavel_relacao})` : ""}`}
                cpf={pac.responsavel_cpf}
              />
              <Pessoa rotulo="Paciente" nome={pac.nome} cpf={pac.cpf} />
            </>
          ) : (
            <Pessoa rotulo="Pago pelo próprio paciente" nome={pac.nome} cpf={pac.cpf} />
          )}
        </section>
      )}

      {p.observacoes && (
        <section className="flex flex-col gap-1.5 rounded-2xl border border-[#DFEBE7] bg-white p-5 text-sm sm:p-6">
          <h2 className="text-base font-bold">Observações</h2>
          <p className="whitespace-pre-wrap text-[#3D524D]">{p.observacoes}</p>
        </section>
      )}
    </div>
  );
}

function Dado({ rotulo, children, fraco }: { rotulo: string; children: React.ReactNode; fraco?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <span className="text-[#4A5F5A]">{rotulo}</span>
      <span className={`text-right font-semibold ${fraco ? "text-[#4A5F5A]" : ""}`}>{children}</span>
    </div>
  );
}

function Pessoa({ rotulo, nome, cpf }: { rotulo: string; nome: string; cpf: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span>
        {rotulo}:{" "}
        <strong className="text-[#12302B]" data-sensivel>
          {nome}
        </strong>
      </span>
      <span className="flex flex-wrap items-center gap-2">
        CPF {cpf ? <CpfRecibo cpf={cpf} /> : <span className="text-[#4A5F5A]">não cadastrado</span>}
      </span>
    </div>
  );
}

function Passo({
  estado,
  titulo,
  sub,
  tomAtraso,
  ultimo,
}: {
  estado: "feito" | "atual" | "futuro";
  titulo: string;
  sub: string;
  /** Classes da pílula de atraso (cor pela idade). */
  tomAtraso?: string;
  ultimo?: boolean;
}) {
  const bolinha =
    estado === "feito"
      ? "border-[#0F766E] bg-[#0F766E] text-white"
      : estado === "atual"
        ? "border-[#C98A0B] bg-white"
        : "border-[#C9D6D2] bg-white";
  return (
    <li className="flex gap-3">
      <span className="flex flex-col items-center">
        <span aria-hidden className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${bolinha}`}>
          {estado === "feito" && "✓"}
        </span>
        {!ultimo && <span className="min-h-5 w-0.5 flex-1 bg-[#C9D6D2]" />}
      </span>
      <span className={`flex flex-col gap-1 ${ultimo ? "" : "pb-4"}`}>
        <span className="text-[15px] font-semibold">{titulo}</span>
        {tomAtraso ? (
          <span className={`w-fit rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tomAtraso}`}>{sub}</span>
        ) : (
          <span className="text-[13px] text-[#4A5F5A]">{sub}</span>
        )}
      </span>
    </li>
  );
}
