import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronRight,
  FileText,
  Receipt,
  UserPlus,
  Video,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import {
  MODALIDADE_LABEL,
  type ConsultaStatus,
  type Modalidade,
} from "@/lib/agenda/types";
import { estadoVisual, exigeEvolucao } from "@/lib/agenda/grade";
import { EstadoBadge } from "@/app/(app)/agenda/estilos";
import {
  addDias,
  dataChaveBR,
  dataLongaBR,
  diaAlvoLembrete,
  horaBR,
  intervaloDiaBR,
  BR_OFFSET,
} from "@/lib/agenda/datas";
import {
  DIAS_PENDENCIA,
  consultasSemEvolucao,
  estadoSessao,
  meetEmDestaque,
  minutosAteInicio,
} from "@/lib/agenda/estado";
import { formatarBRL } from "@/lib/financeiro/types";
import { mesAtual, primeiroDia, ultimoDia } from "@/lib/financeiro/mes";
import { primeiroNome } from "@/lib/lembretes/template";
import { whatsappLink } from "@/lib/pacientes/whatsapp";
import { linkDaConsulta } from "@/lib/agenda/linkOnline";
import { escopoTemCalendar, integracaoGoogleConfigurada } from "@/lib/google/calendar";
import { ConectarGoogleButton } from "@/app/(app)/configuracoes/ConectarGoogleButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { MinutosAte } from "@/components/Relogio";
import { marcosDoDia } from "@/lib/agenda/marcos";
import { resumoFinanceiroMes } from "@/lib/financeiro/resumo";
import { EstadoVazio } from "@/components/EstadoVazio";
import { AvisoCupom } from "./AvisoCupom";

export const metadata = { title: "Painel" };

type PacienteRef = { id: string; nome: string };

type ConsultaPainel = {
  id: string;
  inicio: string;
  fim: string;
  modalidade: Modalidade;
  status: ConsultaStatus;
  confirmada_em: string | null;
  meet_link: string | null;
  pacientes:
    | (PacienteRef & { telefone: string | null; aceita_lembretes: boolean })
    | (PacienteRef & { telefone: string | null; aceita_lembretes: boolean })[]
    | null;
  lembretes: { consulta_inicio: string }[] | null;
};

type ContextoPainel = {
  nome: string | null;
  link_atendimento_online: string | null;
  preferencias_lembrete: { antecedencia_horas: number } | { antecedencia_horas: number }[] | null;
  google_oauth_tokens: { escopo: string | null } | { escopo: string | null }[] | null;
  cupom_avisos: AvisoCupomRow | AvisoCupomRow[] | null;
  assinaturas: { trial_fim: string } | { trial_fim: string }[] | null;
};

type AvisoCupomRow = { codigo: string; status: string; lido_em: string | null };

function unico<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const DIAS_PROXIMOS = 7;
const MAX_PROXIMOS = 8;

export default async function DashboardPage() {
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const agora = new Date();
  const agoraISO = agora.toISOString();
  const hoje = dataChaveBR(agoraISO);
  const { inicio: diaIni, fim: diaFim } = intervaloDiaBR(hoje);
  const limiteProximos = intervaloDiaBR(addDias(hoje, DIAS_PROXIMOS + 1)).inicio;
  const mes = mesAtual();
  const desdePendencias = new Date(
    agora.getTime() - DIAS_PENDENCIA * 86_400_000,
  ).toISOString();

  // Tudo numa rodada só, em paralelo (antes: 15 consultas em 3 rodadas).
  // - consultas: uma janela de DIAS_PENDENCIA dias atrás até DIAS_PROXIMOS à
  //   frente cobre hoje, próximos dias, pendências recentes e o dia-alvo dos
  //   lembretes (antecedência máxima é 168 h = 7 dias); separadas aqui no código.
  //   Os lembretes enviados vêm juntos (embed), sem segunda consulta.
  // - contexto: nome, link fixo, antecedência do lembrete e escopo do Google.
  const [
    { data: contextoRaw },
    { data: consultasRaw },
    { data: evolucoesRaw },
    { count: pendentesTotalRaw },
    financeiro,
  ] = await Promise.all([
    supabase
      .from("psicologas")
      .select(
        "nome, link_atendimento_online, preferencias_lembrete(antecedencia_horas), google_oauth_tokens(escopo), cupom_avisos(codigo, status, lido_em), assinaturas(trial_fim)",
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("consultas")
      .select(
        "id, inicio, fim, modalidade, status, confirmada_em, meet_link, pacientes(id, nome, telefone, aceita_lembretes), lembretes(consulta_inicio)",
      )
      .is("deleted_at", null)
      .gte("inicio", desdePendencias)
      .lt("inicio", limiteProximos)
      .order("inicio")
      .limit(1000),
    // Evoluções recentes: dizem o que já foi registrado. Uma sessão conta como
    // registrada se há evolução ligada a ela OU do mesmo paciente na mesma data
    // (evolução criada pela página do paciente não fica ligada à consulta).
    supabase
      .from("evolucoes")
      .select("id, consulta_id, paciente_id, data_sessao")
      .is("deleted_at", null)
      .gte("data_sessao", addDias(hoje, -(DIAS_PENDENCIA + 1)))
      .limit(1000),
    // Pendências de qualquer data (o card conta todas; a lista do painel só
    // as dos últimos DIAS_PENDENCIA dias).
    supabase.rpc("consultas_sem_evolucao", {}, { count: "exact", head: true }),
    resumoFinanceiroMes(supabase, primeiroDia(mes), ultimoDia(mes), hoje),
  ]);

  const contexto = contextoRaw as ContextoPainel | null;
  const tokenGoogle = unico(contexto?.google_oauth_tokens ?? null);
  const antecedencia = unico(contexto?.preferencias_lembrete ?? null)?.antecedencia_horas ?? 24;
  const alvo = intervaloDiaBR(diaAlvoLembrete(agora, antecedencia));

  // Login em dois passos: a Agenda é conectada depois. Enquanto não estiver,
  // o painel oferece o botão (escopo nulo = token antigo, conta como conectado).
  const agendaPendente =
    integracaoGoogleConfigurada() &&
    (!tokenGoogle || (tokenGoogle.escopo != null && !escopoTemCalendar(tokenGoogle.escopo)));

  const todas = (consultasRaw ?? []) as unknown as ConsultaPainel[];
  const consultasDoDia = todas
    .filter((c) => c.inicio >= diaIni && c.inicio < diaFim)
    .map((c) => ({ ...c, meet_link: linkDaConsulta(c, contexto?.link_atendimento_online) }));
  const consultasHoje = consultasDoDia.filter((c) => c.status !== "cancelada");
  const proximaHoje = consultasHoje.find(
    (c) => c.status === "agendada" && new Date(c.inicio) > agora,
  );
  const proximas = todas
    .filter((c) => c.status === "agendada" && c.inicio >= diaFim)
    .slice(0, MAX_PROXIMOS);
  // Sessões já encerradas (sem canceladas e faltas) nos últimos DIAS_PENDENCIA dias.
  const passadas = todas
    .filter(
      (c) =>
        (c.status === "agendada" || c.status === "realizada") &&
        new Date(c.fim) < agora,
    )
    .reverse();

  const { recebido, aReceber, atrasados } = financeiro;
  const previsto = recebido + aReceber;

  const evolucaoPorConsulta = new Map<string, string>();
  const evolucaoPorPacienteDia = new Map<string, string>();
  for (const e of evolucoesRaw ?? []) {
    if (e.consulta_id) evolucaoPorConsulta.set(e.consulta_id as string, e.id as string);
    evolucaoPorPacienteDia.set(`${e.paciente_id}|${e.data_sessao}`, e.id as string);
  }
  const evolucaoDe = (c: {
    id: string;
    inicio: string;
    pacientes: PacienteRef | PacienteRef[] | null;
  }): string | undefined => {
    const pac = unico(c.pacientes);
    return (
      evolucaoPorConsulta.get(c.id) ??
      (pac
        ? evolucaoPorPacienteDia.get(`${pac.id}|${dataChaveBR(c.inicio)}`)
        : undefined)
    );
  };

  // Lembretes a enviar: consultas do dia-alvo com paciente que aceita, telefone
  // válido e sem registro de envio para o horário atual.
  const lembretesAEnviar = todas.filter((c) => {
    if (c.status !== "agendada" || c.inicio < alvo.inicio || c.inicio >= alvo.fim) return false;
    const p = unico(c.pacientes);
    if (!p?.aceita_lembretes || !whatsappLink(p.telefone)) return false;
    const enviadoPara = unico(c.lembretes)?.consulta_inicio;
    return !(
      enviadoPara && new Date(enviadoPara).getTime() === new Date(c.inicio).getTime()
    );
  }).length;

  const pendentes = consultasSemEvolucao(
    passadas,
    new Set(passadas.filter((c) => evolucaoDe(c)).map((c) => c.id)),
  );
  const evolucoesPendentes = pendentes.length;
  // As duas contas usam a mesma regra; o max só protege de uma diferença de
  // momento entre as duas consultas.
  const pendentesTotal = Math.max(pendentesTotalRaw ?? 0, evolucoesPendentes);
  const MAX_PENDENTES_LISTADAS = 6;

  const nome = contexto?.nome ? primeiroNome(contexto.nome) : "";
  const avisoCupom = unico(contexto?.cupom_avisos ?? null);
  const trialFim = unico(contexto?.assinaturas ?? null)?.trial_fim ?? null;
  const proximaConsulta = proximas[0];

  // Próximos dias agrupados por dia.
  const proximasPorDia = new Map<string, ConsultaPainel[]>();
  for (const c of proximas) {
    const chave = dataChaveBR(c.inicio);
    proximasPorDia.set(chave, [...(proximasPorDia.get(chave) ?? []), c]);
  }
  const rotuloPassado = (chave: string) =>
    chave === hoje
      ? "Hoje"
      : chave === addDias(hoje, -1)
        ? "Ontem"
        : dataLongaBR(`${chave}T12:00:00${BR_OFFSET}`);
  const rotuloDia = (chave: string) =>
    chave === addDias(hoje, 1)
      ? "Amanhã"
      : dataLongaBR(`${chave}T12:00:00${BR_OFFSET}`);

  return (
    <div className="flex w-full flex-col gap-6">
      <AutoRefresh marcos={marcosDoDia(consultasDoDia, hoje)} />

      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">
          {saudacao(agora)}
          {nome ? `, ${nome}` : ""}
        </h1>
        <p className="text-sm first-letter:uppercase text-slate-500">
          {dataLongaBR(`${hoje}T12:00:00${BR_OFFSET}`)}
        </p>
      </div>

      {avisoCupom && !avisoCupom.lido_em && (
        <AvisoCupom codigo={avisoCupom.codigo} status={avisoCupom.status} trialFim={trialFim} />
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador
          rotulo="Consultas hoje"
          valor={String(consultasHoje.length)}
          href="/agenda"
          sub={
            proximaHoje
              ? `Próxima às ${horaBR(proximaHoje.inicio)}`
              : consultasHoje.length > 0
                ? "Nenhuma restante hoje"
                : undefined
          }
        />
        <Indicador
          rotulo="Evoluções pendentes"
          valor={pendentesTotal > 0 ? String(pendentesTotal) : null}
          href="/evolucoes/pendentes"
          destaque={pendentesTotal > 0 ? "amber" : undefined}
          sub={
            pendentesTotal === 0
              ? undefined
              : evolucoesPendentes > 0
                ? `${evolucoesPendentes} nos últimos ${DIAS_PENDENCIA} dias`
                : `Todas com mais de ${DIAS_PENDENCIA} dias`
          }
        />
        <Indicador
          rotulo="Lembretes a enviar"
          valor={lembretesAEnviar > 0 ? String(lembretesAEnviar) : null}
          href="/lembretes"
          destaque={lembretesAEnviar > 0 ? "amber" : undefined}
        />
        <Indicador
          rotulo="Recebido no mês"
          valor={formatarBRL(recebido)}
          href="/financeiro"
          destaque="green"
          sensivel
          sub={previsto > recebido ? `de ${formatarBRL(previsto)} previstos` : undefined}
          progresso={previsto > 0 ? recebido / previsto : undefined}
        />
      </div>

      {agendaPendente && (
        <section className="flex flex-col gap-3 rounded-xl border border-teal-200 bg-teal-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="font-medium text-teal-900">Conecte sua Google Agenda</h2>
            <p className="text-sm text-teal-900/80">
              As consultas aparecem na sua agenda e as online ganham link do
              Meet automaticamente. O app só cria e edita os eventos das
              consultas; não lê o resto da sua agenda.
            </p>
          </div>
          <div className="shrink-0">
            <ConectarGoogleButton
              label="Conectar Google Agenda"
              clientId={process.env.GOOGLE_OAUTH_CLIENT_ID ?? ""}
            />
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href="/agenda/nova" className="btn btn-primary">
          <CalendarPlus className="size-4" aria-hidden />
          Nova consulta
        </Link>
        <Link href="/pacientes/novo" className="btn btn-outline">
          <UserPlus className="size-4" aria-hidden />
          Novo paciente
        </Link>
        <Link href="/financeiro/novo" className="btn btn-outline">
          <Receipt className="size-4" aria-hidden />
          Novo lançamento
        </Link>
        {atrasados > 0 && (
          <Link href="/financeiro" className="btn btn-outline text-red-700">
            {atrasados} pagamento{atrasados === 1 ? "" : "s"} atrasado
            {atrasados === 1 ? "" : "s"}
          </Link>
        )}
      </div>

      {pendentes.length > 0 && (
        <section
          id="pendentes"
          className="flex scroll-mt-4 flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4"
        >
          <div>
            <h2 className="font-medium text-amber-900">
              Evoluções pendentes
              <span className="ml-2 text-sm font-normal text-amber-800">
                {pendentes.length} {pendentes.length === 1 ? "sessão" : "sessões"} sem
                registro nos últimos {DIAS_PENDENCIA} dias
              </span>
            </h2>
            <p className="text-sm text-amber-800">
              A Resolução CFP nº 01/2009 pede o registro documental sempre
              atualizado.
            </p>
          </div>
          <ul className="divide-y divide-amber-200 rounded-lg border border-amber-200 bg-white">
            {pendentes.slice(0, MAX_PENDENTES_LISTADAS).map((c) => {
              const pac = unico(c.pacientes);
              if (!pac) return null;
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="min-w-0 break-words text-sm">
                    <span className="font-medium" data-sensivel>
                      {pac.nome}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {rotuloPassado(dataChaveBR(c.inicio))} · {horaBR(c.inicio)}
                    </span>
                  </span>
                  <Link
                    href={`/pacientes/${pac.id}/evolucoes/nova?consulta=${c.id}&data=${dataChaveBR(c.inicio)}`}
                    className="btn btn-primary btn-sm shrink-0"
                  >
                    <FileText className="size-4" aria-hidden />
                    <span>
                      Registrar<span className="hidden sm:inline"> evolução</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {pendentesTotal > Math.min(pendentes.length, MAX_PENDENTES_LISTADAS) && (
            <Link href="/evolucoes/pendentes" className="text-sm font-semibold text-amber-900 hover:text-amber-950">
              Ver todas as {pendentesTotal} pendências
            </Link>
          )}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section id="hoje" className="flex scroll-mt-4 flex-col gap-3">
          <h2 className="font-medium">
            Hoje
            {consultasHoje.length > 0 && (
              <span className="ml-2 text-sm font-normal text-slate-500">
                {consultasHoje.length} consulta
                {consultasHoje.length === 1 ? "" : "s"}
              </span>
            )}
          </h2>

          {consultasDoDia.length === 0 ? (
            <EstadoVazio
              icon={CalendarCheck}
              titulo="Sem consultas hoje"
              texto={
                proximaConsulta
                  ? `Próxima: ${rotuloDia(dataChaveBR(proximaConsulta.inicio))
                      .toLowerCase()} às ${horaBR(proximaConsulta.inicio)} com ${
                      unico(proximaConsulta.pacientes)?.nome ?? "paciente"
                    }.`
                  : "Sua agenda está livre."
              }
            >
              <Link href="/agenda/nova" className="btn btn-outline btn-sm">
                <CalendarPlus className="size-4" aria-hidden />
                Agendar consulta
              </Link>
            </EstadoVazio>
          ) : (
            <ul className="card divide-y p-0">
              {consultasDoDia.map((c) => {
                const pac = unico(c.pacientes);
                const estado = estadoSessao(c.inicio, c.fim, agora);
                const visual = estadoVisual(c, agora);
                const evolucaoId = evolucaoDe(c);
                const min = minutosAteInicio(c.inicio, agora);
                const ativa = c.status !== "cancelada" && c.status !== "falta";
                const proxima = proximaHoje?.id === c.id;

                return (
                  <li
                    key={c.id}
                    className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                      c.status === "cancelada" ? "opacity-70" : ""
                    } ${proxima && meetEmDestaque(estado) ? "bg-teal-50/60" : ""}`}
                  >
                    <Link
                      href={`/agenda?consulta=${c.id}`}
                      className="flex min-w-0 items-start gap-3 hover:opacity-80"
                    >
                      <span className="flex w-12 shrink-0 flex-col text-sm">
                        <span className="font-semibold">{horaBR(c.inicio)}</span>
                        <span className="text-xs text-slate-500">{horaBR(c.fim)}</span>
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="break-words font-medium" data-sensivel>
                          {pac?.nome ?? "Paciente"}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                          {MODALIDADE_LABEL[c.modalidade]}
                          <EstadoBadge estado={visual} />
                          {ativa && estado === "em_andamento" && (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-800">
                              Em andamento
                            </span>
                          )}
                          {c.status === "agendada" &&
                            (estado === "proxima" || (estado === "futura" && min <= 60)) && (
                              <span className="font-medium text-teal-800">
                                Começa em <MinutosAte inicio={c.inicio} inicialISO={agoraISO} /> min
                              </span>
                            )}
                          {!evolucaoId && exigeEvolucao(c, agora) && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                              Evolução pendente
                            </span>
                          )}
                        </span>
                      </span>
                    </Link>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {c.status === "cancelada" ? (
                        <Link href={`/agenda/${c.id}/editar`} className="btn btn-outline btn-sm">
                          Remarcar
                        </Link>
                      ) : c.status === "falta" ? null : estado === "encerrada" ? (
                        evolucaoId && pac ? (
                          <Link
                            href={`/pacientes/${pac.id}/evolucoes/${evolucaoId}`}
                            className="btn btn-outline btn-sm"
                          >
                            <Check className="size-4 text-green-600" aria-hidden />
                            Evolução registrada
                          </Link>
                        ) : pac ? (
                          <Link
                            href={`/pacientes/${pac.id}/evolucoes/nova?consulta=${c.id}&data=${dataChaveBR(c.inicio)}`}
                            className="btn btn-primary btn-sm"
                          >
                            <FileText className="size-4" aria-hidden />
                            Registrar evolução
                          </Link>
                        ) : null
                      ) : (
                        c.modalidade === "online" &&
                        c.meet_link && (
                          <a
                            href={c.meet_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`btn btn-sm ${
                              meetEmDestaque(estado) ? "btn-primary" : "btn-outline"
                            }`}
                          >
                            <Video className="size-4" aria-hidden />
                            Entrar na chamada
                          </a>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-medium">Próximos dias</h2>
            <Link href="/agenda" className="text-sm text-slate-500 hover:opacity-80">
              Ver agenda
            </Link>
          </div>

          {proximas.length === 0 ? (
            <EstadoVazio
              icon={CalendarClock}
              titulo="Nada agendado nos próximos 7 dias"
              texto="As consultas marcadas para a próxima semana aparecem aqui."
            >
              <Link href="/agenda/nova" className="btn btn-primary btn-sm">
                <CalendarPlus className="size-4" aria-hidden />
                Nova consulta
              </Link>
            </EstadoVazio>
          ) : (
            <div className="card flex flex-col gap-4">
              {[...proximasPorDia.entries()].map(([dia, lista]) => (
                <div key={dia} className="flex flex-col gap-1">
                  <h3 className="text-xs font-semibold text-slate-500 first-letter:uppercase">
                    {rotuloDia(dia)}
                  </h3>
                  <ul className="flex flex-col">
                    {lista.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`/agenda?consulta=${c.id}`}
                          className="flex items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
                        >
                          <span className="min-w-0 break-words">
                            <span className="font-medium">{horaBR(c.inicio)}</span> ·{" "}
                            <span data-sensivel>{unico(c.pacientes)?.nome ?? "Paciente"}</span>
                          </span>
                          <span className="shrink-0 text-xs text-slate-500">
                            {MODALIDADE_LABEL[c.modalidade]}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function saudacao(agora: Date): string {
  const h = Number(horaBR(agora.toISOString()).slice(0, 2));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function Indicador({
  rotulo,
  valor,
  href,
  destaque,
  sub,
  sensivel = false,
  progresso,
}: {
  rotulo: string;
  /** null = nada pendente: mostra "Tudo em dia". */
  valor: string | null;
  href: string;
  destaque?: "green" | "amber" | "red";
  sub?: string;
  sensivel?: boolean;
  /** 0–1: barra de progresso abaixo do valor. */
  progresso?: number;
}) {
  const tom = {
    green: "text-green-700",
    amber: "text-amber-700",
    red: "text-red-700",
  }[destaque ?? "green"];
  return (
    <Link
      href={href}
      className="card flex flex-col gap-1 hover:border-teal-300"
    >
      <span className="flex items-center justify-between text-xs text-slate-500">
        {rotulo}
        <ChevronRight className="size-4" aria-hidden />
      </span>
      {valor === null ? (
        <span className="flex items-center gap-1.5 text-lg font-semibold text-teal-700 sm:text-xl">
          <Check className="size-5" aria-hidden />
          Tudo em dia
        </span>
      ) : (
        <span
          className={`text-xl font-semibold sm:text-2xl ${
            destaque ? tom : "text-slate-900"
          }`}
          data-sensivel={sensivel || undefined}
        >
          {valor}
        </span>
      )}
      {sub && (
        <span className="text-xs text-slate-500" data-sensivel={sensivel || undefined}>
          {sub}
        </span>
      )}
      {progresso !== undefined && (
        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-200">
          <span
            className="block h-full rounded-full bg-teal-700"
            style={{ width: `${Math.min(100, Math.round(progresso * 100))}%` }}
          />
        </span>
      )}
    </Link>
  );
}
