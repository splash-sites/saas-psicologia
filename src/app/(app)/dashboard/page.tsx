import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Check,
  FileText,
  Receipt,
  UserPlus,
  Video,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MODALIDADE_LABEL, type Modalidade } from "@/lib/agenda/types";
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
  estadoSessao,
  meetEmDestaque,
  minutosAteInicio,
} from "@/lib/agenda/estado";
import { formatarBRL } from "@/lib/financeiro/types";
import { mesAtual, primeiroDia, ultimoDia } from "@/lib/financeiro/mes";
import { primeiroNome } from "@/lib/lembretes/template";
import { whatsappLink } from "@/lib/pacientes/whatsapp";
import { AutoRefresh } from "@/components/AutoRefresh";
import { EstadoVazio } from "@/components/EstadoVazio";

export const metadata = { title: "Painel" };

type PacienteRef = { id: string; nome: string };

type ConsultaHoje = {
  id: string;
  inicio: string;
  fim: string;
  modalidade: Modalidade;
  meet_link: string | null;
  pacientes: PacienteRef | PacienteRef[] | null;
};

type ConsultaProxima = {
  id: string;
  inicio: string;
  modalidade: Modalidade;
  pacientes: PacienteRef | PacienteRef[] | null;
};

function unico<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const DIAS_PROXIMOS = 7;
const MAX_PROXIMOS = 8;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const agora = new Date();
  const hoje = dataChaveBR(agora.toISOString());
  const { inicio: diaIni, fim: diaFim } = intervaloDiaBR(hoje);
  const limiteProximos = intervaloDiaBR(addDias(hoje, DIAS_PROXIMOS + 1)).inicio;
  const mes = mesAtual();

  const { data: pref } = await supabase
    .from("preferencias_lembrete")
    .select("antecedencia_horas")
    .eq("psicologa_id", user.id)
    .maybeSingle();
  const diaAlvo = diaAlvoLembrete(agora, pref?.antecedencia_horas ?? 24);
  const alvo = intervaloDiaBR(diaAlvo);

  const [
    { data: psicologa },
    { data: consultasHojeRaw },
    { data: proximasRaw },
    { data: consultasAlvoRaw },
    { data: recebidosRaw },
    { count: atrasados },
  ] = await Promise.all([
    supabase.from("psicologas").select("nome").eq("id", user.id).maybeSingle(),
    supabase
      .from("consultas")
      .select("id, inicio, fim, modalidade, meet_link, pacientes(id, nome)")
      .neq("status", "cancelada")
      .is("deleted_at", null)
      .gte("inicio", diaIni)
      .lt("inicio", diaFim)
      .order("inicio"),
    supabase
      .from("consultas")
      .select("id, inicio, modalidade, pacientes(id, nome)")
      .eq("status", "agendada")
      .is("deleted_at", null)
      .gte("inicio", diaFim)
      .lt("inicio", limiteProximos)
      .order("inicio")
      .limit(MAX_PROXIMOS),
    supabase
      .from("consultas")
      .select("id, inicio, pacientes(telefone, aceita_lembretes)")
      .eq("status", "agendada")
      .is("deleted_at", null)
      .gte("inicio", alvo.inicio)
      .lt("inicio", alvo.fim),
    supabase
      .from("pagamentos")
      .select("valor")
      .is("deleted_at", null)
      .eq("status", "pago")
      .gte("data_pagamento", primeiroDia(mes))
      .lte("data_pagamento", ultimoDia(mes)),
    supabase
      .from("pagamentos")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("status", "pendente")
      .lt("vencimento", hoje),
  ]);

  const consultasHoje = (consultasHojeRaw ?? []) as unknown as ConsultaHoje[];
  const proximas = (proximasRaw ?? []) as unknown as ConsultaProxima[];
  const recebido = (recebidosRaw ?? []).reduce((s, r) => s + Number(r.valor), 0);

  // Evolução já registrada para cada consulta de hoje (para saber o que falta).
  const { data: evolucoesRaw } = consultasHoje.length
    ? await supabase
        .from("evolucoes")
        .select("id, consulta_id")
        .is("deleted_at", null)
        .in(
          "consulta_id",
          consultasHoje.map((c) => c.id),
        )
    : { data: [] };
  const evolucaoDaConsulta = new Map(
    (evolucoesRaw ?? []).map((e) => [e.consulta_id as string, e.id as string]),
  );

  // Lembretes a enviar: consultas do dia-alvo com paciente que aceita, telefone
  // válido e sem registro de envio para o horário atual.
  const alvoConsultas = (consultasAlvoRaw ?? []) as unknown as {
    id: string;
    inicio: string;
    pacientes:
      | { telefone: string | null; aceita_lembretes: boolean }
      | { telefone: string | null; aceita_lembretes: boolean }[]
      | null;
  }[];
  const { data: enviadosRaw } = alvoConsultas.length
    ? await supabase
        .from("lembretes")
        .select("consulta_id, consulta_inicio")
        .in(
          "consulta_id",
          alvoConsultas.map((c) => c.id),
        )
    : { data: [] };
  const enviados = new Map(
    (enviadosRaw ?? []).map((l) => [l.consulta_id as string, l.consulta_inicio as string]),
  );
  const lembretesAEnviar = alvoConsultas.filter((c) => {
    const p = unico(c.pacientes);
    if (!p?.aceita_lembretes || !whatsappLink(p.telefone)) return false;
    const enviadoPara = enviados.get(c.id);
    return !(
      enviadoPara && new Date(enviadoPara).getTime() === new Date(c.inicio).getTime()
    );
  }).length;

  const evolucoesPendentes = consultasHoje.filter(
    (c) =>
      estadoSessao(c.inicio, c.fim, agora) === "encerrada" &&
      !evolucaoDaConsulta.has(c.id),
  ).length;

  const nome = psicologa?.nome ? primeiroNome(psicologa.nome) : "";
  const proximaConsulta = proximas[0];

  // Próximos dias agrupados por dia.
  const proximasPorDia = new Map<string, ConsultaProxima[]>();
  for (const c of proximas) {
    const chave = dataChaveBR(c.inicio);
    proximasPorDia.set(chave, [...(proximasPorDia.get(chave) ?? []), c]);
  }
  const rotuloDia = (chave: string) =>
    chave === addDias(hoje, 1)
      ? "Amanhã"
      : dataLongaBR(`${chave}T12:00:00${BR_OFFSET}`);

  return (
    <div className="flex w-full flex-col gap-6">
      <AutoRefresh />

      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">
          Olá{nome ? `, ${nome}` : ""}
        </h1>
        <p className="text-sm first-letter:uppercase text-slate-500">
          {dataLongaBR(`${hoje}T12:00:00${BR_OFFSET}`)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador
          rotulo="Consultas hoje"
          valor={String(consultasHoje.length)}
          href="/agenda"
        />
        <Indicador
          rotulo="Evoluções pendentes hoje"
          valor={String(evolucoesPendentes)}
          href="#hoje"
          destaque={evolucoesPendentes > 0 ? "amber" : undefined}
        />
        <Indicador
          rotulo="Lembretes a enviar"
          valor={String(lembretesAEnviar)}
          href="/lembretes"
          destaque={lembretesAEnviar > 0 ? "amber" : undefined}
        />
        <Indicador
          rotulo="Recebido no mês"
          valor={formatarBRL(recebido)}
          href="/financeiro"
          destaque="green"
        />
      </div>

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
        {(atrasados ?? 0) > 0 && (
          <Link href="/financeiro" className="btn btn-outline text-red-700">
            {atrasados} pagamento{atrasados === 1 ? "" : "s"} atrasado
            {atrasados === 1 ? "" : "s"}
          </Link>
        )}
      </div>

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

          {consultasHoje.length === 0 ? (
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
              {consultasHoje.map((c) => {
                const pac = unico(c.pacientes);
                const estado = estadoSessao(c.inicio, c.fim, agora);
                const evolucaoId = evolucaoDaConsulta.get(c.id);
                const min = minutosAteInicio(c.inicio, agora);

                return (
                  <li
                    key={c.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <Link
                      href={`/agenda/${c.id}`}
                      className="flex min-w-0 flex-col hover:underline"
                    >
                      <span className="break-words font-medium">
                        {horaBR(c.inicio)}–{horaBR(c.fim)} · {pac?.nome ?? "Paciente"}
                      </span>
                      <span className="text-xs text-slate-500">
                        {MODALIDADE_LABEL[c.modalidade]}
                        {estado === "em_andamento" && (
                          <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-800">
                            Em andamento
                          </span>
                        )}
                        {(estado === "proxima" || (estado === "futura" && min <= 60)) && (
                          <span className="ml-2 text-teal-700">
                            Começa em {min} min
                          </span>
                        )}
                        {estado === "encerrada" && !evolucaoId && (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                            Evolução pendente
                          </span>
                        )}
                      </span>
                    </Link>

                    <div className="flex flex-wrap items-center gap-2">
                      {estado === "encerrada" ? (
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
                            Entrar no Meet
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
            <Link href="/agenda" className="text-sm text-slate-500 hover:underline">
              Ver agenda
            </Link>
          </div>

          {proximas.length === 0 ? (
            <EstadoVazio
              icon={CalendarClock}
              titulo="Nada agendado nos próximos 7 dias"
              texto="Que tal marcar as próximas sessões?"
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
                          href={`/agenda/${c.id}`}
                          className="flex items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
                        >
                          <span className="min-w-0 break-words">
                            <span className="font-medium">{horaBR(c.inicio)}</span>{" "}
                            · {unico(c.pacientes)?.nome ?? "Paciente"}
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

function Indicador({
  rotulo,
  valor,
  href,
  destaque,
}: {
  rotulo: string;
  valor: string;
  href: string;
  destaque?: "green" | "amber" | "red";
}) {
  const tom = {
    green: "text-green-700",
    amber: "text-amber-700",
    red: "text-red-700",
  }[destaque ?? "green"];
  return (
    <Link href={href} className="card block hover:border-teal-300">
      <div className="text-xs text-slate-500">{rotulo}</div>
      <div
        className={`mt-1 text-xl font-semibold sm:text-2xl ${
          destaque ? tom : "text-slate-900"
        }`}
      >
        {valor}
      </div>
    </Link>
  );
}
