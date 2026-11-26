import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, Video } from "lucide-react";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { EstadoVazio } from "@/components/EstadoVazio";
import { NavegacaoPeriodo } from "@/components/NavegacaoPeriodo";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { brWallTimeToDate, dataChaveBR, hojeBR, horaBR } from "@/lib/agenda/datas";
import { formatarBRL } from "@/lib/financeiro/types";
import { CLASSE_TOM } from "@/lib/financeiro/situacao";
import { mesAtual, mesAnterior, mesSeguinte, primeiroDia, ultimoDia, rotuloMes } from "@/lib/financeiro/mes";
import { corAvatar, iniciais } from "@/lib/pacientes/avatar";

export const metadata = { title: "Previsto" };

// Detalhe do card "Previsto até o fim do mês" (2026-11-24; visual do redesenho
// do Financeiro em 2026-11-25): sessões que ainda não aconteceram, cada uma uma
// vez — mesma regra de resumo_sessoes_mes (0037): com lançamento pendente vale
// o lançamento; sem lançamento, o valor da consulta; paga adiantado fica de
// fora. Mais lançamentos sem sessão com data futura. Só mês atual ou futuro.

type Item = {
  chave: string;
  quando: string;
  hora: string | null;
  pacienteId: string;
  nome: string;
  valor: number;
  href: string;
  /** "Sessão online", "Sessão presencial" ou "Lançamento". */
  referente: string;
  online: boolean;
  /** Já tem lançamento pendente (lançado antes da sessão). */
  lancado: boolean;
};
type Pac = { id: string; nome: string };
const um = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const tituloDia = (iso: string, hoje: string) =>
  `${iso === hoje ? "Hoje · " : ""}${SEMANA[new Date(`${iso}T12:00:00Z`).getUTCDay()]}, ${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]}`;
const n = (x: number, um1: string, varios: string) => `${x} ${x === 1 ? um1 : varios}`;

export default async function PrevistoPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes: mesParam } = await searchParams;
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const mes = /^\d{4}-\d{2}$/.test(mesParam ?? "") ? mesParam! : mesAtual();
  if (mes < mesAtual()) redirect(`/financeiro?mes=${mes}`);
  const inicio = primeiroDia(mes);
  const fim = ultimoDia(mes);
  const hoje = hojeBR();
  const agora = new Date().getTime();
  const deISO = brWallTimeToDate(inicio, "00:00").toISOString();
  const ateISO = brWallTimeToDate(primeiroDia(mesSeguinte(mes)), "00:00").toISOString();

  const [{ data: consultasRaw }, { data: pendentesRaw }] = await Promise.all([
    supabase
      .from("consultas")
      .select("id, inicio, fim, valor, modalidade, pacientes(id, nome)")
      .eq("status", "agendada")
      .is("deleted_at", null)
      .not("valor", "is", null)
      .gte("inicio", deISO)
      .lt("inicio", ateISO)
      .gt("fim", new Date(agora).toISOString())
      .order("inicio")
      .limit(1000),
    supabase
      .from("pagamentos")
      .select("id, consulta_id, valor, data_referencia, consultas(inicio, fim, modalidade), pacientes(id, nome)")
      .eq("status", "pendente")
      .is("deleted_at", null)
      .gte("data_referencia", inicio)
      .lte("data_referencia", fim)
      .limit(1000),
  ]);

  type Consulta = { id: string; inicio: string; fim: string; valor: number; modalidade: string; pacientes: Pac | Pac[] | null };
  type ConsultaPend = { inicio: string; fim: string; modalidade: string };
  type Pend = {
    id: string;
    consulta_id: string | null;
    valor: number;
    data_referencia: string;
    consultas: ConsultaPend | ConsultaPend[] | null;
    pacientes: Pac | Pac[] | null;
  };
  const consultas = (consultasRaw ?? []) as unknown as Consulta[];
  const pendentes = (pendentesRaw ?? []) as unknown as Pend[];

  // Consultas que já têm qualquer lançamento (pendente ou pago) não entram pelo valor delas.
  const ids = consultas.map((c) => c.id);
  const { data: comLancamento } = ids.length
    ? await supabase.from("pagamentos").select("consulta_id").in("consulta_id", ids).is("deleted_at", null)
    : { data: [] };
  const lancadas = new Set((comLancamento ?? []).map((l) => l.consulta_id as string));

  const itens: Item[] = [
    ...consultas
      .filter((c) => !lancadas.has(c.id))
      .map((c) => {
        const p = um(c.pacientes);
        return {
          chave: `c-${c.id}`,
          quando: dataChaveBR(c.inicio),
          hora: horaBR(c.inicio),
          pacienteId: p?.id ?? c.id,
          nome: p?.nome ?? "Paciente",
          valor: Number(c.valor),
          href: `/agenda?consulta=${c.id}`,
          referente: `Sessão ${c.modalidade === "online" ? "online" : "presencial"}`,
          online: c.modalidade === "online",
          lancado: false,
        };
      }),
    ...pendentes
      .filter((p) => {
        const c = um(p.consultas);
        return c ? new Date(c.fim).getTime() > agora : p.data_referencia > hoje;
      })
      .map((p) => {
        const c = um(p.consultas);
        const pac = um(p.pacientes);
        return {
          chave: `p-${p.id}`,
          quando: c ? dataChaveBR(c.inicio) : p.data_referencia,
          hora: c ? horaBR(c.inicio) : null,
          pacienteId: pac?.id ?? p.id,
          nome: pac?.nome ?? "Paciente",
          valor: Number(p.valor),
          href: `/financeiro/${p.id}`,
          referente: c ? `Sessão ${c.modalidade === "online" ? "online" : "presencial"}` : "Lançamento",
          online: c?.modalidade === "online",
          lancado: true,
        };
      }),
  ].sort((a, b) => (a.quando + (a.hora ?? "")).localeCompare(b.quando + (b.hora ?? "")));

  const total = itens.reduce((s, i) => s + i.valor, 0);
  const pacientes = new Set(itens.map((i) => i.pacienteId)).size;
  const proxima = itens[0];
  const dias = [...itens.reduce((m, i) => m.set(i.quando, [...(m.get(i.quando) ?? []), i]), new Map<string, Item[]>())];
  const nomeMes = rotuloMes(mes).split(" de ")[0].toLowerCase();

  return (
    <div className="flex w-full max-w-5xl flex-col gap-5 text-[#12302B]">
      <CabecalhoPagina
        titulo="Previsto até o fim do mês"
        voltar={{ href: `/financeiro?mes=${mes}`, rotulo: "Financeiro" }}
        periodo={
          <NavegacaoPeriodo
            anterior={{ href: `/financeiro/previsto?mes=${mesAnterior(mes)}`, rotulo: "Mês anterior" }}
            atual={{ href: "/financeiro/previsto", rotulo: "Mês atual" }}
            proximo={{ href: `/financeiro/previsto?mes=${mesSeguinte(mes)}`, rotulo: "Próximo mês" }}
            periodo={rotuloMes(mes)}
          />
        }
        descricao="Sessões marcadas com valor que ainda não aconteceram. Depois da sessão, o valor passa para “A receber”."
      />

      {itens.length === 0 ? (
        <EstadoVazio icon={CalendarClock} titulo="Nada previsto" texto="Nenhuma sessão com valor marcada para o resto do mês." />
      ) : (
        <>
          {/* Resumo */}
          <section aria-label="Resumo" className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
            <div className="col-span-2 flex flex-col gap-1 rounded-2xl bg-[#12302B] px-5 py-4 text-[#F4F7F6] lg:col-span-1">
              <span className="text-[13px] text-[#C9DAD5]">Previsto até o fim de {nomeMes}</span>
              <span className="text-[28px] font-bold tracking-tight" data-sensivel>
                {formatarBRL(total)}
              </span>
              <span className="text-[13px] text-[#C9DAD5]">
                {n(itens.length, "sessão", "sessões")} de {n(pacientes, "paciente", "pacientes")}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl border border-[#DFEBE7] bg-white px-4 py-3.5">
              <span className="text-[13px] text-[#4A5F5A]">Próxima sessão</span>
              <span className="text-xl font-bold">
                {proxima.quando.slice(8, 10)}/{proxima.quando.slice(5, 7)}
                {proxima.hora && <span className="font-semibold text-[#3D524D]"> · {proxima.hora}</span>}
              </span>
              <span className="truncate text-[13px] text-[#4A5F5A]" data-sensivel>
                {proxima.nome}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl border border-[#DFEBE7] bg-white px-4 py-3.5">
              <span className="text-[13px] text-[#4A5F5A]">Dias com sessão</span>
              <span className="text-xl font-bold">{dias.length}</span>
              <span className="text-[13px] text-[#4A5F5A]">até {Number(fim.slice(8, 10))} de {nomeMes}</span>
            </div>
          </section>

          {/* Lista por dia */}
          <div className="flex flex-col gap-3 lg:gap-0 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-[#DFEBE7] lg:bg-white">
            <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_120px] gap-4 border-b border-[#E6EEEB] bg-[#F7FAF9] px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#4A5F5A] lg:grid">
              <span>Paciente</span>
              <span>Referente a</span>
              <span>Situação</span>
              <span className="text-right">Valor</span>
            </div>
            {dias.map(([dia, itensDia]) => (
              <section key={dia} className="flex flex-col gap-1.5 lg:gap-0">
                <div className="flex justify-between px-0.5 pt-1 text-[13px] font-semibold text-[#3D524D] lg:border-b lg:border-[#EEF3F1] lg:bg-[#FBFDFC] lg:px-5 lg:py-2">
                  <span>{tituloDia(dia, hoje)}</span>
                  <span className="font-medium text-[#4A5F5A]" data-sensivel>
                    {formatarBRL(itensDia.reduce((s, i) => s + i.valor, 0))}
                  </span>
                </div>
                <ul className="overflow-hidden rounded-2xl border border-[#DFEBE7] bg-white lg:rounded-none lg:border-0">
                  {itensDia.map((i) => (
                    <li key={i.chave} className="border-t border-[#F1F5F4] first:border-t-0">
                      <Linha i={i} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Linha({ i }: { i: Item }) {
  const avatar = (tam: string) => (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-full text-xs font-bold ${tam} ${corAvatar(i.pacienteId)}`} data-sensivel>
      {iniciais(i.nome)}
    </span>
  );
  const referente = (
    <span className="flex items-center gap-1.5 text-[13px] text-[#4A5F5A]">
      {i.online && <Video className="size-3.5" aria-hidden />}
      {i.referente}
      {i.hora && ` · ${i.hora}`}
    </span>
  );
  const pilula = (
    <span className={`inline-flex w-fit items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CLASSE_TOM.neutro}`}>
      {i.lancado ? "Lançado · a receber" : "Previsto"}
    </span>
  );
  return (
    <Link href={i.href} className="block hover:bg-[#F7FAF9]">
      {/* Computador */}
      <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_120px] items-center gap-4 px-5 py-3 lg:grid">
        <span className="flex min-w-0 items-center gap-2.5">
          {avatar("size-8")}
          <span className="truncate text-[15px] font-semibold" data-sensivel>
            {i.nome}
          </span>
        </span>
        {referente}
        {pilula}
        <span className="text-right text-[15px] font-bold" data-sensivel>
          {formatarBRL(i.valor)}
        </span>
      </div>
      {/* Celular */}
      <div className="flex flex-col gap-2 px-3 py-2.5 lg:hidden">
        <span className="flex items-center gap-2.5">
          {avatar("size-[34px]")}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[15px] font-semibold" data-sensivel>
              {i.nome}
            </span>
            {referente}
          </span>
          <span className="text-[15px] font-bold" data-sensivel>
            {formatarBRL(i.valor)}
          </span>
        </span>
        <span className="pl-[44px]">{pilula}</span>
      </div>
    </Link>
  );
}
