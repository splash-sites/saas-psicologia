import Link from "next/link";
import { gerarLancamentosDasSessoes } from "@/lib/financeiro/gerar";
import { diasDoBloqueio } from "@/lib/agenda/bloqueios";
import { feriadosDaPsicologa } from "@/lib/feriados";
import { avisoDaProxima, proximasSessoes } from "@/lib/agenda/feriadoProxima";
import { aniversariantesPorDia, idadeNoAniversario, mensagemAniversario, type PacienteNascimento } from "@/lib/aniversario";
import { whatsappLinkComTexto } from "@/lib/pacientes/whatsapp";
import { redirect } from "next/navigation";
import { CalendarOff, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { BotaoNovoFlutuante } from "./MenuNovo";
import { PainelEvento, type EventoDoPainel } from "./PainelEvento";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import type { Bloqueio, Consulta } from "@/lib/agenda/types";
import {
  segundaDaSemana,
  diasDaSemana,
  addDias,
  dataChaveBR,
  dataBR,
  BR_OFFSET,
} from "@/lib/agenda/datas";
import { registrarAcesso } from "@/lib/prontuario/acesso";
import { proximaSessaoDoPaciente } from "@/lib/prontuario/anotacoes";
import {
  estadoVisual,
  exigeEvolucao,
  faixaDeHoras,
} from "@/lib/agenda/grade";
import { AutoRefresh } from "@/components/AutoRefresh";
import { marcosDoDia } from "@/lib/agenda/marcos";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { NavegacaoPeriodo } from "@/components/NavegacaoPeriodo";
import { GradeSemana } from "./GradeSemana";
import { DiaLista } from "./DiaLista";
import { linkDaConsulta, linkDoEvento } from "@/lib/agenda/linkOnline";
import { PainelConsulta } from "./PainelConsulta";
import { CLASSE_ANIVERSARIO, EstadoBadge, HACHURA_BLOQUEIO } from "./estilos";
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
  | "valor"
  | "cobrar"
  | "tem_anotacoes"
  | "dispensa_evolucao"
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
    evento?: string;
    canceladas?: string;
    anotar?: string;
  }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const agora = new Date();
  const agoraISO = agora.toISOString();
  const hoje = dataChaveBR(agoraISO);
  const consultaSel = sp.consulta && UUID_RE.test(sp.consulta) ? sp.consulta : undefined;
  const eventoSel = !consultaSel && sp.evento && UUID_RE.test(sp.evento) ? sp.evento : undefined;

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
  // Mesmo para um evento (?evento=) sem semana.
  if (!segunda && eventoSel) {
    const { data: alvo } = await supabase.from("bloqueios").select("inicio").eq("id", eventoSel).maybeSingle();
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
    evento: eventoSel,
    ocultarCanceladas: sp.canceladas === "0",
  };

  // Lançamentos "a receber" das sessões que já passaram (0035). Roda junto com
  // a 1ª leitura (que não lê pagamentos) e termina antes de ler os pagamentos:
  // uma rodada a menos ao banco.
  const gerando = gerarLancamentosDasSessoes(supabase);

  const inicioSemana = new Date(`${segunda}T00:00:00${BR_OFFSET}`).toISOString();
  const fimSemana = new Date(`${addDias(segunda, 7)}T00:00:00${BR_OFFSET}`).toISOString();

  const [
    { data: consultasRaw },
    { data: bloqueiosRaw },
    { data: evolucoesRaw },
    { data: psicologa },
    { data: nascimentosRaw },
    { data: eventoRaw },
  ] = await Promise.all([
      supabase
        .from("consultas")
        .select(
          "id, inicio, fim, modalidade, status, recorrencia, serie_id, confirmada_em, meet_link, valor, cobrar, tem_anotacoes, dispensa_evolucao, pacientes(id, nome)",
        )
        .is("deleted_at", null)
        .gte("inicio", inicioSemana)
        .lt("inicio", fimSemana)
        .order("inicio"),
      supabase
        .from("bloqueios")
        .select("id, inicio, fim, motivo, dia_inteiro, online")
        // Por sobreposição: férias que começaram na semana anterior também entram.
        .lt("inicio", fimSemana)
        .gt("fim", inicioSemana)
        .order("inicio"),
      supabase
        .from("evolucoes")
        .select("id, consulta_id, paciente_id, data_sessao")
        .is("deleted_at", null)
        .gte("data_sessao", semana[0])
        .lte("data_sessao", semana[6]),
      supabase
        .from("psicologas")
        .select("link_atendimento_online, feriados_uf, mostrar_feriados, mensagem_aniversario")
        .eq("id", user.id)
        .maybeSingle(),
      // Aniversários (item H): todos os pacientes com data, menos arquivados.
      supabase
        .from("pacientes")
        .select("id, nome, data_nascimento, telefone")
        .is("deleted_at", null)
        .not("data_nascimento", "is", null)
        .limit(1000),
      // Evento aberto no painel (0047).
      eventoSel
        ? supabase
            .from("bloqueios")
            .select("id, inicio, fim, motivo, dia_inteiro, online, meet_link, serie_id, recorrencia, sync_status, sync_erro")
            .eq("id", eventoSel)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const rows = (consultasRaw ?? []) as unknown as ConsultaRow[];
  const ids = rows.map((r) => r.id);

  const linhaSel = consultaSel ? rows.find((r) => r.id === consultaSel) : undefined;
  await gerando;
  const pacienteSelId = linhaSel ? (unico(linhaSel.pacientes)?.id ?? null) : null;
  const [{ data: pagamentosRaw }, { data: lembreteRaw }, proximas, anotacaoSel] = await Promise.all([
    ids.length
      ? supabase
          .from("pagamentos")
          .select("id, consulta_id, valor, status, vencimento, data_pagamento, forma_pagamento, created_at")
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
    // Aviso de feriado na sessão anterior (0039): a próxima do mesmo paciente.
    linhaSel && psicologa?.mostrar_feriados !== false
      ? proximasSessoes(supabase, [
          { id: linhaSel.id, inicio: linhaSel.inicio, status: linhaSel.status, paciente_id: unico(linhaSel.pacientes)?.id ?? null },
        ])
      : Promise.resolve(new Map()),
    // Anotações para a sessão (0043): texto só da consulta aberta.
    linhaSel ? anotacoesDaConsulta(supabase, linhaSel, pacienteSelId) : Promise.resolve(null),
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
  type Pag = {
    id: string;
    valor: number;
    status: "pendente" | "pago";
    vencimento: string;
    data_pagamento: string | null;
    forma_pagamento: string | null;
  };
  const pagPorConsulta = new Map<string, Pag>();
  for (const p of pagamentosRaw ?? []) {
    const cid = p.consulta_id as string;
    if (!pagPorConsulta.has(cid)) {
      pagPorConsulta.set(cid, {
        id: p.id as string,
        valor: Number(p.valor),
        status: p.status as Pag["status"],
        vencimento: p.vencimento as string,
        data_pagamento: (p.data_pagamento as string | null) ?? null,
        forma_pagamento: (p.forma_pagamento as string | null) ?? null,
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
      meet_link: linkDaConsulta(r, psicologa?.link_atendimento_online),
      paciente,
      valor: r.valor === null ? null : Number(r.valor),
      cobrar: r.cobrar,
      estado: estadoVisual(r, agora),
      evolucaoId,
      evolucaoPendente: !evolucaoId && exigeEvolucao(r, agora),
      pagamentoPendente: pagPorConsulta.get(r.id)?.status === "pendente",
      temAnotacoes: r.tem_anotacoes,
      dispensa_evolucao: r.dispensa_evolucao,
    };
  });

  const visiveis = params.ocultarCanceladas
    ? todas.filter((c) => c.status !== "cancelada" || c.id === consultaSel)
    : todas;
  const todosBloqueios = (bloqueiosRaw ?? []) as Pick<
    Bloqueio,
    "id" | "inicio" | "fim" | "motivo" | "dia_inteiro" | "online"
  >[] as ItemBloqueio[];
  // Dia inteiro vira faixa no topo do dia (não estica a grade de horários).
  const bloqueios = todosBloqueios.filter((b) => !b.dia_inteiro);
  const diasBloqueados = new Map<string, { id: string; motivo: string }>();
  for (const b of todosBloqueios.filter((x) => x.dia_inteiro)) {
    for (const d of diasDoBloqueio(b)) {
      if (semana.includes(d)) diasBloqueados.set(d, { id: b.id, motivo: b.motivo || "Evento" });
    }
  }

  const feriados = feriadosDaPsicologa(semana, psicologa);
  const nascimentos = (nascimentosRaw ?? []) as PacienteNascimento[];
  const aniversarios = aniversariantesPorDia(nascimentos, semana);
  const consultasPorDia = agrupar(visiveis, (c) => dataChaveBR(c.inicio));
  // Canceladas de cada dia, mesmo ocultas (o celular mostra "1 cancelada oculta").
  const canceladasPorDia = new Map<string, number>();
  for (const c of todas) {
    if (c.status !== "cancelada") continue;
    const d = dataChaveBR(c.inicio);
    canceladasPorDia.set(d, (canceladasPorDia.get(d) ?? 0) + 1);
  }
  const bloqueiosPorDia = agrupar(bloqueios, (b) => dataChaveBR(b.inicio));

  // Domingo só aparece na grade se houver algo nele.
  const domingo = semana[6];
  const diasGrade =
    consultasPorDia.has(domingo) || bloqueiosPorDia.has(domingo) || diasBloqueados.has(domingo) || feriados.has(domingo) || aniversarios.has(domingo)
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
  const ev = eventoRaw as Omit<EventoDoPainel, "link"> | null;
  const eventoDoPainel: EventoDoPainel | null = ev ? { ...ev, link: linkDoEvento(ev, psicologa?.link_atendimento_online) } : null;
  // A sessão cai no aniversário do paciente?
  const pacSel = selecionada?.paciente ? nascimentos.find((p) => p.id === selecionada.paciente!.id) : undefined;
  const idadeSel = pacSel && selecionada ? idadeNoAniversario(pacSel.data_nascimento, dataChaveBR(selecionada.inicio)) : null;
  const aniversarioDaSessao =
    pacSel && selecionada && idadeSel !== null
      ? {
          nome: pacSel.nome,
          idade: idadeSel,
          hoje: dataChaveBR(selecionada.inicio) === hoje,
          whatsapp: whatsappLinkComTexto(pacSel.telefone, mensagemAniversario(psicologa?.mensagem_aniversario, pacSel.nome)),
        }
      : null;
  const lembrete = lembreteRaw as { consulta_inicio: string; enviado_em: string } | null;
  const lembreteValido =
    selecionada &&
    lembrete &&
    new Date(lembrete.consulta_inicio).getTime() === new Date(selecionada.inicio).getTime()
      ? lembrete.enviado_em
      : null;

  return (
    <div className="flex w-full flex-col gap-4">
      <AutoRefresh marcos={marcosDoDia(rows, hoje)} />

      {/* Celular: topo enxuto (canvas "Celular"): título, eventos e a semana. */}
      <div className="flex items-center justify-between gap-2 md:hidden">
        <h1 className="text-[22px] font-bold tracking-tight text-[#12302B]">Agenda</h1>
        <div className="flex items-center">
          <Link
            href="/agenda/eventos"
            aria-label="Eventos (férias, compromissos)"
            className="flex size-11 items-center justify-center rounded-[10px] text-[#3D524D] hover:bg-[#EEF3F1]"
          >
            <CalendarOff className="size-[18px]" aria-hidden />
          </Link>
          <Link
            href={agendaHref({ semana: addDias(segunda, -7), ocultarCanceladas: params.ocultarCanceladas })}
            aria-label="Semana anterior"
            className="flex size-11 items-center justify-center rounded-[10px] hover:bg-[#EEF3F1]"
          >
            <ChevronLeft className="size-[18px] text-[#12302B]" aria-hidden />
          </Link>
          {semana.includes(hoje) ? (
            <span className="text-sm font-semibold text-[#3D524D]">{rotuloSemanaCurto(semana)}</span>
          ) : (
            <Link
              href={params.ocultarCanceladas ? "/agenda?canceladas=0" : "/agenda"}
              aria-label="Voltar para hoje"
              className="flex flex-col items-center rounded-lg px-1 text-sm font-semibold leading-tight text-[#3D524D]"
            >
              {rotuloSemanaCurto(semana)}
              <span className="text-[11px] font-semibold text-[#0F766E]">Voltar para hoje</span>
            </Link>
          )}
          <Link
            href={agendaHref({ semana: addDias(segunda, 7), ocultarCanceladas: params.ocultarCanceladas })}
            aria-label="Próxima semana"
            className="flex size-11 items-center justify-center rounded-[10px] hover:bg-[#EEF3F1]"
          >
            <ChevronRight className="size-[18px] text-[#12302B]" aria-hidden />
          </Link>
        </div>
      </div>

      <div className="hidden md:flex md:flex-col md:gap-4">
      <CabecalhoPagina
        titulo="Agenda"
        periodo={
          <NavegacaoPeriodo
            anterior={{
              href: agendaHref({ semana: addDias(segunda, -7), ocultarCanceladas: params.ocultarCanceladas }),
              rotulo: "Semana anterior",
            }}
            atual={{ href: params.ocultarCanceladas ? "/agenda?canceladas=0" : "/agenda", rotulo: "Hoje" }}
            proximo={{
              href: agendaHref({ semana: addDias(segunda, 7), ocultarCanceladas: params.ocultarCanceladas }),
              rotulo: "Próxima semana",
            }}
            periodo={rotuloSemana(semana)}
          />
        }
        acoes={
          <>
            <Link href="/agenda/eventos" className="btn btn-outline">
              Eventos
            </Link>
            <Link href="/agenda/nova" className="btn btn-primary">
              <Plus className="size-4" aria-hidden />
              Nova consulta
            </Link>
          </>
        }
      />

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
            className="text-sm font-medium text-teal-800 hover:opacity-80"
          >
            {params.ocultarCanceladas ? "Mostrar canceladas" : "Ocultar canceladas"}
          </Link>
        )}
      </div>
      </div>

      <div className="hidden md:block">
        <GradeSemana
          dias={diasGrade}
          hoje={hoje}
          agoraISO={agoraISO}
          consultasPorDia={consultasPorDia}
          bloqueiosPorDia={bloqueiosPorDia}
          diasBloqueados={diasBloqueados}
          feriados={feriados}
          aniversarios={aniversarios}
          faixa={faixa}
          params={params}
        />
      </div>
      <div className="md:hidden">
        <DiaLista
          key={`${segunda}-${dia}`}
          semana={semana}
          diaInicial={dia}
          canceladasPorDia={canceladasPorDia}
          hoje={hoje}
          agoraISO={agoraISO}
          consultasPorDia={consultasPorDia}
          bloqueiosPorDia={bloqueiosPorDia}
          diasBloqueados={diasBloqueados}
          feriados={feriados}
          aniversarios={aniversarios}
          params={params}
        />
      </div>

      {/* Celular: "+" flutuante (canvas "Celular") com "Nova consulta"/"Novo evento". */}
      <BotaoNovoFlutuante voltar={agendaHref({ ...params, consulta: undefined, evento: undefined })} />

      <Legenda />

      {selecionada && (
        <PainelConsulta
          c={selecionada}
          pagamento={pagPorConsulta.get(selecionada.id) ?? null}
          lembreteEnviadoEm={lembreteValido}
          avisoFeriado={avisoDaProxima(proximas.get(selecionada.id), psicologa)}
          aniversario={aniversarioDaSessao}
          anotacoes={{
            texto: anotacaoSel?.texto ?? null,
            levarPara: anotacaoSel?.levarPara ?? null,
            abrirEditando: sp.anotar === "1",
          }}
          observacoes={anotacaoSel?.observacoes ?? null}
          hoje={hoje}
          agoraISO={agoraISO}
          fecharHref={agendaHref({ ...params, consulta: undefined })}
          aquiHref={agendaHref(params)}
        />
      )}

      {eventoDoPainel && (
        <PainelEvento
          e={eventoDoPainel}
          fecharHref={agendaHref({ ...params, evento: undefined })}
          voltarHref={agendaHref({ ...params, evento: undefined })}
          aquiHref={agendaHref(params)}
        />
      )}
    </div>
  );
}

/**
 * Observações e anotações da consulta aberta (só dela, não da semana toda).
 * Com anotação, registra o acesso ao prontuário; sessão cancelada/falta com
 * anotação procura a próxima marcada ("Levar para a próxima sessão").
 */
async function anotacoesDaConsulta(
  supabase: Awaited<ReturnType<typeof createClient>>,
  linha: ConsultaRow,
  pacienteId: string | null,
): Promise<{ texto: string | null; levarPara: string | null; observacoes: string | null }> {
  const { data } = await supabase
    .from("consultas")
    .select(linha.tem_anotacoes ? "observacoes, anotacoes_sessao" : "observacoes")
    .eq("id", linha.id)
    .maybeSingle();
  const linhaDb = data as { observacoes: string | null; anotacoes_sessao?: string | null } | null;
  const observacoes = linhaDb?.observacoes ?? null;
  const texto = linhaDb?.anotacoes_sessao ?? null;
  if (!texto || !pacienteId) return { texto: null, levarPara: null, observacoes };
  const naoAconteceu = linha.status === "cancelada" || linha.status === "falta";
  const [, proxima] = await Promise.all([
    registrarAcesso(supabase, "anotacao", pacienteId),
    naoAconteceu ? proximaSessaoDoPaciente(supabase, pacienteId, linha.inicio) : Promise.resolve(null),
  ]);
  return { texto, levarPara: proxima ? dataBR(proxima.inicio) : null, observacoes };
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
        <span className="h-3.5 w-4 rounded" style={HACHURA_BLOQUEIO} />
        Evento
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className={`h-3.5 w-4 rounded-full border ${CLASSE_ANIVERSARIO}`} />
        Aniversário
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-4 rounded border border-rose-200 bg-rose-100" />
        Feriado
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

/** Celular: "23–29 nov" ou "30 nov – 6 dez". */
function rotuloSemanaCurto(semana: string[]): string {
  const [, ma, da] = semana[0].split("-").map(Number);
  const [, mb, db] = semana[6].split("-").map(Number);
  const mes = (m: number) => MESES[m - 1].slice(0, 3);
  return ma === mb ? `${da}–${db} ${mes(mb)}` : `${da} ${mes(ma)} – ${db} ${mes(mb)}`;
}

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
