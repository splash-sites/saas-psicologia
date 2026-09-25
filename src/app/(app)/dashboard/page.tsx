import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlus, UserPlus, Receipt, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MODALIDADE_LABEL, type Modalidade } from "@/lib/agenda/types";
import {
  dataChaveBR,
  dataLongaBR,
  diaAlvoLembrete,
  horaBR,
  intervaloDiaBR,
  BR_OFFSET,
} from "@/lib/agenda/datas";
import { formatarBRL } from "@/lib/financeiro/types";
import { mesAtual, primeiroDia, ultimoDia } from "@/lib/financeiro/mes";
import { primeiroNome } from "@/lib/lembretes/template";
import { whatsappLink } from "@/lib/pacientes/whatsapp";

export const metadata = { title: "Painel" };

type ConsultaHoje = {
  id: string;
  inicio: string;
  fim: string;
  modalidade: Modalidade;
  meet_link: string | null;
  pacientes: { nome: string } | { nome: string }[] | null;
};

function nomeDe(p: ConsultaHoje["pacientes"]): string {
  if (!p) return "Paciente";
  return (Array.isArray(p) ? p[0]?.nome : p.nome) ?? "Paciente";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const agora = new Date();
  const hoje = dataChaveBR(agora.toISOString());
  const { inicio: diaIni, fim: diaFim } = intervaloDiaBR(hoje);
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
    { data: consultasAlvoRaw },
    { data: recebidosRaw },
    { count: atrasados },
  ] = await Promise.all([
    supabase.from("psicologas").select("nome").eq("id", user.id).maybeSingle(),
    supabase
      .from("consultas")
      .select("id, inicio, fim, modalidade, meet_link, pacientes(nome)")
      .neq("status", "cancelada")
      .is("deleted_at", null)
      .gte("inicio", diaIni)
      .lt("inicio", diaFim)
      .order("inicio"),
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
  const recebido = (recebidosRaw ?? []).reduce((s, r) => s + Number(r.valor), 0);

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
    const p = Array.isArray(c.pacientes) ? c.pacientes[0] : c.pacientes;
    if (!p?.aceita_lembretes || !whatsappLink(p.telefone)) return false;
    const enviadoPara = enviados.get(c.id);
    return !(
      enviadoPara && new Date(enviadoPara).getTime() === new Date(c.inicio).getTime()
    );
  }).length;

  const nome = psicologa?.nome ? primeiroNome(psicologa.nome) : "";

  return (
    <div className="flex w-full flex-col gap-6">
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
        <Indicador
          rotulo="Pagamentos atrasados"
          valor={String(atrasados ?? 0)}
          href="/financeiro"
          destaque={(atrasados ?? 0) > 0 ? "red" : undefined}
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
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Hoje</h2>
        {consultasHoje.length === 0 ? (
          <p className="card text-sm text-slate-500">
            Nenhuma consulta hoje.
          </p>
        ) : (
          <ul className="card divide-y p-0">
            {consultasHoje.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <Link
                  href={`/agenda/${c.id}`}
                  className="flex min-w-0 flex-col hover:underline"
                >
                  <span className="font-medium">
                    {horaBR(c.inicio)}–{horaBR(c.fim)} · {nomeDe(c.pacientes)}
                  </span>
                  <span className="text-xs text-slate-500">
                    {MODALIDADE_LABEL[c.modalidade]}
                  </span>
                </Link>
                {c.modalidade === "online" && c.meet_link && (
                  <a
                    href={c.meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline btn-sm"
                  >
                    <Video className="size-4" aria-hidden />
                    Entrar no Meet
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
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
