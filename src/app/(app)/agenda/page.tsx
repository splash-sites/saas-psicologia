import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Bloqueio, Consulta } from "@/lib/agenda/types";
import {
  segundaDaSemana,
  diasDaSemana,
  addDias,
  dataChaveBR,
  BR_OFFSET,
} from "@/lib/agenda/datas";
import {
  estadoVisual,
  exigeEvolucao,
  faixaDeHoras,
} from "@/lib/agenda/grade";
import { AutoRefresh } from "@/components/AutoRefresh";
import { GradeSemana } from "./GradeSemana";
import { DiaLista } from "./DiaLista";
import { PainelConsulta } from "./PainelConsulta";
import { EstadoBadge, HACHURA_BLOQUEIO } from "./estilos";
import {
  agendaHref,
  type ItemBloqueio,
  type ItemConsulta,
  type ParamsAgenda,
} from "./tipos";

export const metadata = { title: "Agenda" };

type ConsultaRow = Pick<
  Consulta,
  | "id"
  | "inicio"
  | "fim"
  | "modalidade"
  | "status"
  | "recorrencia"
  | "serie_id"
  | "confirmada_em"
  | "meet_link"
> & { pacientes: { id: string; nome: string } | { id: string; nome: string }[] | null };

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f-]{36}$/i;

function unico<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{
    semana?: string;
    dia?: string;
    consulta?: string;
    canceladas?: string;
  }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const agora = new Date();
  const agoraISO = agora.toISOString();
  const hoje = dataChaveBR(agoraISO);
  const consultaSel = sp.consulta && UUID_RE.test(sp.consulta) ? sp.consulta : undefined;

  // Link direto para uma consulta (?consulta=) sem semana: abre a semana dela.
  let segunda = sp.semana && DATA_RE.test(sp.semana) ? sp.semana : undefined;
  let diaPadrao: string | undefined;
  if (!segunda && consultaSel) {
    const { data: alvo } = await supabase
      .from("consultas")
      .select("inicio")
      .eq("id", consultaSel)
      .is("deleted_at", null)
      .maybeSingle();
    if (alvo) {
      segunda = segundaDaSemana(new Date(alvo.inicio));
      diaPadrao = dataChaveBR(alvo.inicio);
    }
  }
  segunda ??= segundaDaSemana(agora);

  const semana = diasDaSemana(segunda);
  const dia =
    sp.dia && semana.includes(sp.dia)
      ? sp.dia
      : (diaPadrao ?? (semana.includes(hoje) ? hoje : semana[0]));
  const params: ParamsAgenda = {
    semana: segunda,
    dia: sp.dia && semana.includes(sp.dia) ? sp.dia : undefined,
    consulta: consultaSel,
    ocultarCanceladas: sp.canceladas === "0",
  };

  const inicioSemana = new Date(`${segunda}T00:00:00${BR_OFFSET}`).toISOString();
  const fimSemana = new Date(`${addDias(segunda, 7)}T00:00:00${BR_OFFSET}`).toISOString();

  const [{ data: consultasRaw }, { data: bloqueiosRaw }, { data: evolucoesRaw }] =
    await Promise.all([
      supabase
        .from("consultas")
        .select(
          "id, inicio, fim, modalidade, status, recorrencia, serie_id, confirmada_em, meet_link, pacientes(id, nome)",
        )
        .is("deleted_at", null)
        .gte("inicio", inicioSemana)
        .lt("inicio", fimSemana)
        .order("inicio"),
      supabase
        .from("bloqueios")
        .select("id, inicio, fim, motivo")
        .gte("inicio", inicioSemana)
        .lt("inicio", fimSemana)
        .order("inicio"),
      supabase
        .from("evolucoes")
        .select("id, consulta_id, paciente_id, data_sessao")
        .is("deleted_at", null)
        .gte("data_sessao", semana[0])
        .lte("data_sessao", semana[6]),
    ]);

  const rows = (consultasRaw ?? []) as unknown as ConsultaRow[];
  const ids = rows.map((r) => r.id);

  const [{ data: pagamentosRaw }, { data: lembreteRaw }] = await Promise.all([
    ids.length
      ? supabase
          .from("pagamentos")
          .select("id, consulta_id, valor, status, vencimento, created_at")
          .is("deleted_at", null)
          .in("consulta_id", ids)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
    consultaSel
      ? supabase
          .from("lembretes")
          .select("consulta_inicio, enviado_em")
          .eq("consulta_id", consultaSel)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Evolução da sessão: ligada à consulta, ou do mesmo paciente no mesmo dia
  // (evolução criada pela página do paciente não fica ligada à consulta).
  const evoPorConsulta = new Map<string, string>();
  const evoPorPacienteDia = new Map<string, string>();
  for (const e of evolucoesRaw ?? []) {
    if (e.consulta_id) evoPorConsulta.set(e.consulta_id as string, e.id as string);
    evoPorPacienteDia.set(`${e.paciente_id}|${e.data_sessao}`, e.id as string);
  }
  // Mais recente primeiro: o primeiro visto por consulta é o que vale.
  type Pag = { id: string; valor: number; status: "pendente" | "pago"; vencimento: string };
  const pagPorConsulta = new Map<string, Pag>();
  for (const p of pagamentosRaw ?? []) {
    const cid = p.consulta_id as string;
    if (!pagPorConsulta.has(cid)) {
      pagPorConsulta.set(cid, {
        id: p.id as string,
        valor: Number(p.valor),
        status: p.status as Pag["status"],
        vencimento: p.vencimento as string,
      });
    }
  }

  const todas: ItemConsulta[] = rows.map((r) => {
    const paciente = unico(r.pacientes);
    const evolucaoId =
      evoPorConsulta.get(r.id) ??
      (paciente
        ? evoPorPacienteDia.get(`${paciente.id}|${dataChaveBR(r.inicio)}`)
        : undefined);
    return {
      id: r.id,
      inicio: r.inicio,
      fim: r.fim,
      modalidade: r.modalidade,
      status: r.status,
      recorrencia: r.recorrencia,
      serie_id: r.serie_id,
      confirmada_em: r.confirmada_em,
      meet_link: r.meet_link,
      paciente,
      estado: estadoVisual(r, agora),
      evolucaoId,
      evolucaoPendente: !evolucaoId && exigeEvolucao(r, agora),
      pagamentoPendente: pagPorConsulta.get(r.id)?.status === "pendente",
    };
  });

  const visiveis = params.ocultarCanceladas
    ? todas.filter((c) => c.status !== "cancelada" || c.id === consultaSel)
    : todas;
  const bloqueios = (bloqueiosRaw ?? []) as Pick<
    Bloqueio,
    "id" | "inicio" | "fim" | "motivo"
  >[] as ItemBloqueio[];

  const consultasPorDia = agrupar(visiveis, (c) => dataChaveBR(c.inicio));
  const bloqueiosPorDia = agrupar(bloqueios, (b) => dataChaveBR(b.inicio));

  // Domingo só aparece na grade se houver algo nele.
  const domingo = semana[6];
  const diasGrade =
    consultasPorDia.has(domingo) || bloqueiosPorDia.has(domingo)
      ? semana
      : semana.slice(0, 6);
  const faixa = faixaDeHoras([...visiveis, ...bloqueios]);

  const contagem = {
    ativas: todas.filter((c) => c.status !== "cancelada").length,
    confirmadas: todas.filter((c) => c.estado === "confirmada").length,
    aConfirmar: todas.filter((c) => c.estado === "a_confirmar").length,
    canceladas: todas.filter((c) => c.status === "cancelada").length,
    faltas: todas.filter((c) => c.status === "falta").length,
  };

  const selecionada = consultaSel ? todas.find((c) => c.id === consultaSel) : undefined;
  const lembrete = lembreteRaw as { consulta_inicio: string; enviado_em: string } | null;
  const lembreteValido =
    selecionada &&
    lembrete &&
    new Date(lembrete.consulta_inicio).getTime() === new Date(selecionada.inicio).getTime()
      ? lembrete.enviado_em
      : null;

  return (
    <div className="flex w-full flex-col gap-4">
      <AutoRefresh />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-xl font-semibold sm:text-2xl">Agenda</h1>
          <div className="flex items-center gap-1">
            <Link
              href={agendaHref({ semana: addDias(segunda, -7), ocultarCanceladas: params.ocultarCanceladas })}
              className="btn btn-outline size-10 !min-h-0 !p-0"
              aria-label="Semana anterior"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
            <Link
              href={params.ocultarCanceladas ? "/agenda?canceladas=0" : "/agenda"}
              className="btn btn-outline"
            >
              Hoje
            </Link>
            <Link
              href={agendaHref({ semana: addDias(segunda, 7), ocultarCanceladas: params.ocultarCanceladas })}
              className="btn btn-outline size-10 !min-h-0 !p-0"
              aria-label="Próxima semana"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
          <span className="text-base font-semibold">{rotuloSemana(semana)}</span>
        </div>
        <div className="flex gap-2">
          <Link href="/agenda/bloqueios" className="btn btn-outline">
            Bloqueios
          </Link>
          <Link href="/agenda/nova" className="btn btn-primary">
            <Plus className="size-4" aria-hidden />
            Nova consulta
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-700">
        <div className="flex flex-wrap gap-2">
          <Chip>
            <b>{contagem.ativas}</b> {contagem.ativas === 1 ? "consulta" : "consultas"}
          </Chip>
          {contagem.confirmadas + contagem.aConfirmar > 0 && (
            <Chip>
              <b>{contagem.confirmadas}</b> confirmada{contagem.confirmadas === 1 ? "" : "s"} ·{" "}
              <b>{contagem.aConfirmar}</b> a confirmar
            </Chip>
          )}
          {contagem.canceladas + contagem.faltas > 0 && (
            <Chip>
              <b>{contagem.canceladas}</b> cancelada{contagem.canceladas === 1 ? "" : "s"} ·{" "}
              <b>{contagem.faltas}</b> falta{contagem.faltas === 1 ? "" : "s"}
            </Chip>
          )}
        </div>
        {contagem.canceladas > 0 && (
          <Link
            href={agendaHref({ ...params, consulta: undefined, ocultarCanceladas: !params.ocultarCanceladas })}
            scroll={false}
            className="text-sm font-medium text-teal-800 hover:underline"
          >
            {params.ocultarCanceladas ? "Mostrar canceladas" : "Ocultar canceladas"}
          </Link>
        )}
      </div>

      <div className="hidden md:block">
        <GradeSemana
          dias={diasGrade}
          hoje={hoje}
          agoraISO={agoraISO}
          consultasPorDia={consultasPorDia}
          bloqueiosPorDia={bloqueiosPorDia}
          faixa={faixa}
          params={params}
        />
      </div>
      <div className="md:hidden">
        <DiaLista
          semana={semana}
          dia={dia}
          hoje={hoje}
          agoraISO={agoraISO}
          consultasPorDia={consultasPorDia}
          bloqueiosPorDia={bloqueiosPorDia}
          params={params}
        />
      </div>

      <Legenda />

      {selecionada && (
        <PainelConsulta
          c={selecionada}
          pagamento={pagPorConsulta.get(selecionada.id) ?? null}
          lembreteEnviadoEm={lembreteValido}
          hoje={hoje}
          agoraISO={agoraISO}
          fecharHref={agendaHref({ ...params, consulta: undefined })}
          aquiHref={agendaHref(params)}
        />
      )}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 [&_b]:font-bold [&_b]:text-slate-900">
      {children}
    </span>
  );
}

function Legenda() {
  return (
    <div className="hidden flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600 md:flex">
      <EstadoBadge estado="confirmada" />
      <EstadoBadge estado="a_confirmar" />
      <EstadoBadge estado="realizada" />
      <EstadoBadge estado="falta" />
      <EstadoBadge estado="cancelada" />
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-4 rounded border border-slate-200" style={HACHURA_BLOQUEIO} />
        Bloqueio
      </span>
      <span className="ml-auto text-slate-500">
        Clique num horário vazio para agendar
      </span>
    </div>
  );
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "21 – 27 de setembro de 2026" ou "28 de setembro – 4 de outubro de 2026". */
function rotuloSemana(semana: string[]): string {
  const [a, b] = [semana[0], semana[6]];
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  if (ya !== yb) return `${da} de ${MESES[ma - 1]} de ${ya} – ${db} de ${MESES[mb - 1]} de ${yb}`;
  if (ma !== mb) return `${da} de ${MESES[ma - 1]} – ${db} de ${MESES[mb - 1]} de ${yb}`;
  return `${da} – ${db} de ${MESES[mb - 1]} de ${yb}`;
}

function agrupar<T>(itens: T[], chave: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of itens) {
    const k = chave(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}
