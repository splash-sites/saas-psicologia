import Link from "next/link";
import { redirect } from "next/navigation";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { NavegacaoPeriodo } from "@/components/NavegacaoPeriodo";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { hojeBR } from "@/lib/agenda/datas";
import { formatarBRL } from "@/lib/financeiro/types";
import { mesAtual, mesAnterior, mesSeguinte, primeiroDia, ultimoDia, rotuloMes } from "@/lib/financeiro/mes";
import { situacaoLancamento } from "@/lib/financeiro/situacao";
import { gerarLancamentosDasSessoes } from "@/lib/financeiro/gerar";
import { Pilula } from "../Pilula";
import { pendentesAte, realizado, type Pendente } from "./lista";
import { TabelaAReceber, type GrupoTabela } from "./TabelaAReceber";
import { TopoCelular } from "../TopoCelular";

export const metadata = { title: "A receber" };

// A receber (redesenho de 2026-11-25, canvas "Main"/"Celular" do usuário):
// sessões que já aconteceram e não foram pagas, por paciente. Resumo no topo,
// abas Este mês / Meses anteriores / Tudo (relativas ao mês escolhido, com as
// setas de mês), "Só atrasados" (o card "Atrasados do mês" do Financeiro abre
// aqui), ordenar por mais antigo ou maior valor e "Dar baixa" dentro da linha.
// "Em aberto há N dias" conta do VENCIMENTO (cobrança mensal: "A vencer").

type Aba = "mes" | "anteriores" | "tudo";
const um = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export default async function AReceberPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; aba?: string; atrasados?: string; ver?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : mesAtual();
  // Links antigos: ?ver=atrasados (meses anteriores) e ?ver=vencidos (atrasados do mês).
  const aba: Aba = sp.ver === "atrasados" ? "anteriores" : sp.aba === "anteriores" || sp.aba === "tudo" ? sp.aba : "mes";
  const soAtrasados = sp.atrasados === "1" || sp.ver === "vencidos";
  const inicio = primeiroDia(mes);
  const fim = ultimoDia(mes);
  const hoje = hojeBR();
  const agora = new Date().getTime();

  await gerarLancamentosDasSessoes(supabase);
  const todos = (await pendentesAte(supabase, fim)).filter((p) => realizado(p, hoje, agora));
  const doMes = todos.filter((p) => p.data_referencia >= inicio);
  const anteriores = todos.filter((p) => p.data_referencia < inicio);
  const daAba = aba === "mes" ? doMes : aba === "anteriores" ? anteriores : todos;
  const visiveis = soAtrasados ? daAba.filter((p) => p.vencimento < hoje) : daAba;

  const soma = (xs: Pendente[]) => xs.reduce((s, p) => s + Number(p.valor), 0);
  const pacientes = (xs: Pendente[]) => new Set(xs.map((p) => p.paciente_id)).size;
  const n = (x: number, um1: string, varios: string) => `${x} ${x === 1 ? um1 : varios}`;

  // O mais antigo em aberto: o de vencimento mais velho (de todos os meses).
  const maisAntigo = todos.reduce<Pendente | null>((m, p) => (!m || p.vencimento < m.vencimento ? p : m), null);

  const grupos: GrupoTabela[] = agruparPorPaciente(visiveis, hoje);
  const base = `/financeiro/a-receber?mes=${mes}`;
  const href = (a: Aba, atrasados = soAtrasados) => `${base}${a === "mes" ? "" : `&aba=${a}`}${atrasados ? "&atrasados=1" : ""}`;
  const nomeMes = rotuloMes(mes).split(" de ")[0].toLowerCase();

  return (
    <div className="flex w-full max-w-5xl flex-col gap-5 text-[#12302B]">
      <TopoCelular
        titulo="A receber"
        voltar={{ href: `/financeiro?mes=${mes}`, rotulo: "Financeiro" }}
        periodo={rotuloMes(mes)}
        anteriorHref={`/financeiro/a-receber?mes=${mesAnterior(mes)}${aba === "mes" ? "" : `&aba=${aba}`}`}
        proximoHref={`/financeiro/a-receber?mes=${mesSeguinte(mes)}${aba === "mes" ? "" : `&aba=${aba}`}`}
        mesAtualHref={mes === mesAtual() ? null : `/financeiro/a-receber${aba === "mes" ? "" : `?aba=${aba}`}`}
        descricao="Sessões que já aconteceram e ainda não foram pagas."
      />
      <div className="hidden md:block">
        <CabecalhoPagina
          titulo="A receber"
          voltar={{ href: `/financeiro?mes=${mes}`, rotulo: "Financeiro" }}
          periodo={
            <NavegacaoPeriodo
              anterior={{ href: `/financeiro/a-receber?mes=${mesAnterior(mes)}${aba === "mes" ? "" : `&aba=${aba}`}`, rotulo: "Mês anterior" }}
              atual={{ href: "/financeiro/a-receber", rotulo: "Mês atual" }}
              proximo={{ href: `/financeiro/a-receber?mes=${mesSeguinte(mes)}${aba === "mes" ? "" : `&aba=${aba}`}`, rotulo: "Próximo mês" }}
              periodo={rotuloMes(mes)}
            />
          }
          descricao="Sessões que já aconteceram e ainda não foram pagas."
        />
      </div>

      {/* Resumo */}
      <section aria-label="Resumo" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <div className="col-span-2 flex flex-col gap-1 rounded-2xl bg-[#12302B] px-5 py-4 text-[#F4F7F6] lg:col-span-1">
          <span className="text-[13px] text-[#C9DAD5]">Total em aberto</span>
          <span className="text-[28px] font-bold tracking-tight" data-sensivel>
            {formatarBRL(soma(todos))}
          </span>
          <span className="text-[13px] text-[#C9DAD5]">
            {n(todos.length, "sessão", "sessões")} de {n(pacientes(todos), "paciente", "pacientes")}
          </span>
        </div>
        <CardResumo rotulo={`De ${nomeMes}`} valor={formatarBRL(soma(doMes))} sub={n(pacientes(doMes), "paciente", "pacientes")} />
        <CardResumo rotulo="De meses anteriores" valor={formatarBRL(soma(anteriores))} sub={n(pacientes(anteriores), "paciente", "pacientes")} />
        <div className="col-span-2 flex flex-col gap-1.5 rounded-2xl border border-[#DFEBE7] bg-white px-4 py-3.5 lg:col-span-1">
          <span className="text-[13px] text-[#4A5F5A]">Em aberto há mais tempo</span>
          {maisAntigo ? (
            <>
              <Pilula situacao={situacaoLancamento(maisAntigo, hoje)} />
              <span className="truncate text-[13px] text-[#4A5F5A]" data-sensivel>
                {um(maisAntigo.pacientes)?.nome ?? "Paciente"}
              </span>
            </>
          ) : (
            <span className="text-lg font-bold">—</span>
          )}
        </div>
      </section>

      {/* Abas e filtro */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Período" className="grid grid-cols-3 gap-0.5 rounded-xl bg-[#E8EFEC] p-1 sm:flex">
          <Aba href={href("mes")} ativa={aba === "mes"} rotulo="Este mês" n={pacientes(doMes)} />
          <Aba href={href("anteriores")} ativa={aba === "anteriores"} rotulo="Meses anteriores" curto="Anteriores" n={pacientes(anteriores)} />
          <Aba href={href("tudo")} ativa={aba === "tudo"} rotulo="Tudo" n={pacientes(todos)} />
        </div>
        <Link
          href={href(aba, !soAtrasados)}
          aria-pressed={soAtrasados}
          className={`inline-flex min-h-10 items-center rounded-xl border px-3.5 text-[13px] font-semibold ${
            soAtrasados ? "border-[#F1C2A8] bg-[#FCE6DA] text-[#7A2A0A]" : "border-[#DFEBE7] bg-white text-[#3D524D] hover:bg-[#F2FAF8]"
          }`}
        >
          {soAtrasados ? "✓ " : ""}Só atrasados
        </Link>
      </div>

      <TabelaAReceber
        key={`${mes}-${aba}-${soAtrasados}`}
        grupos={grupos}
        hoje={hoje}
        vazio={
          soAtrasados
            ? "Nada atrasado aqui."
            : aba === "mes"
              ? `Nada em aberto de ${nomeMes}.`
              : aba === "anteriores"
                ? "Nada em aberto de meses anteriores."
                : "Nada em aberto. Todas as sessões realizadas estão pagas."
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-xs text-[#4A5F5A]">
        <span>Atrasado há:</span>
        <span className="rounded-full border border-[#EBD49A] bg-[#FBF2DC] px-2 py-0.5 font-semibold text-[#5C460F]">até 30 dias</span>
        <span className="rounded-full border border-[#F1C2A8] bg-[#FCE6DA] px-2 py-0.5 font-semibold text-[#7A2A0A]">31 a 90 dias</span>
        <span className="rounded-full border border-[#F5C6D7] bg-[#FCE7EF] px-2 py-0.5 font-semibold text-[#8A1F4C]">mais de 90 dias</span>
        <span className="text-[#5B6E69]">· contado do vencimento</span>
      </div>
    </div>
  );
}

function agruparPorPaciente(itens: Pendente[], hoje: string): GrupoTabela[] {
  const mapa = new Map<string, GrupoTabela>();
  for (const p of itens) {
    const g =
      mapa.get(p.paciente_id) ??
      ({ pacienteId: p.paciente_id, nome: um(p.pacientes)?.nome ?? "Paciente", sessoes: [], total: 0, situacao: situacaoLancamento(p, hoje), maisVelho: p.vencimento } satisfies GrupoTabela);
    g.sessoes.push({
      id: p.id,
      data: p.data_referencia,
      vencimento: p.vencimento,
      valor: Number(p.valor),
      sessao: Boolean(um(p.consultas)),
    });
    g.total += Number(p.valor);
    if (p.vencimento < g.maisVelho) {
      g.maisVelho = p.vencimento;
      g.situacao = situacaoLancamento(p, hoje);
    }
    mapa.set(p.paciente_id, g);
  }
  return [...mapa.values()];
}

function CardResumo({ rotulo, valor, sub }: { rotulo: string; valor: string; sub: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-[#DFEBE7] bg-white px-4 py-3.5">
      <span className="text-[13px] text-[#4A5F5A]">{rotulo}</span>
      <span className="text-xl font-bold" data-sensivel>
        {valor}
      </span>
      <span className="text-[13px] text-[#4A5F5A]">{sub}</span>
    </div>
  );
}

function Aba({ href, ativa, rotulo, curto, n }: { href: string; ativa: boolean; rotulo: string; curto?: string; n: number }) {
  return (
    <Link
      href={href}
      aria-current={ativa ? "page" : undefined}
      className={`flex min-h-10 items-center justify-center whitespace-nowrap rounded-[9px] px-3 text-[13px] ${
        ativa ? "bg-white font-semibold shadow-[0_1px_2px_rgba(18,48,43,0.12)]" : "font-medium text-[#3D524D] hover:text-[#12302B]"
      }`}
    >
      {curto ? (
        <>
          <span className="sm:hidden">{curto}</span>
          <span className="hidden sm:inline">{rotulo}</span>
        </>
      ) : (
        rotulo
      )}
      <span className="ml-1.5 font-medium text-[#4A5F5A]">{n}</span>
    </Link>
  );
}
