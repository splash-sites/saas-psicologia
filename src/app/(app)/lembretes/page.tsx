import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { MODALIDADE_LABEL, type Modalidade } from "@/lib/agenda/types";
import {
  addDias,
  dataBR,
  dataLongaBR,
  diaAlvoLembrete,
  horaBR,
  intervaloDiaBR,
  BR_OFFSET,
} from "@/lib/agenda/datas";
import { renderizarLembrete } from "@/lib/lembretes/template";
import { whatsappLinkComTexto } from "@/lib/pacientes/whatsapp";
import { EnviarWhatsAppButton } from "./EnviarWhatsAppButton";

export const metadata = { title: "Lembretes" };

type PacienteEmbed = {
  id: string;
  nome: string;
  telefone: string | null;
  aceita_lembretes: boolean;
};

type Linha = {
  id: string;
  inicio: string;
  modalidade: Modalidade;
  meet_link: string | null;
  pacientes: PacienteEmbed | PacienteEmbed[] | null;
};

function umPaciente(p: Linha["pacientes"]): PacienteEmbed | null {
  if (!p) return null;
  return Array.isArray(p) ? (p[0] ?? null) : p;
}

export default async function LembretesPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>;
}) {
  const { data: dataParam } = await searchParams;
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const { data: pref } = await supabase
    .from("preferencias_lembrete")
    .select("antecedencia_horas, mensagem_template")
    .eq("psicologa_id", user.id)
    .maybeSingle();

  const padrao = diaAlvoLembrete(new Date(), pref?.antecedencia_horas ?? 24);
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(dataParam ?? "") ? dataParam! : padrao;
  const { inicio, fim } = intervaloDiaBR(dia);

  const { data: consultasRaw } = await supabase
    .from("consultas")
    .select("id, inicio, modalidade, meet_link, pacientes(id, nome, telefone, aceita_lembretes)")
    .eq("status", "agendada")
    .is("deleted_at", null)
    .gte("inicio", inicio)
    .lt("inicio", fim)
    .order("inicio");

  const consultas = (consultasRaw ?? []) as unknown as Linha[];

  const { data: enviadosRaw } = consultas.length
    ? await supabase
        .from("lembretes")
        .select("consulta_id, consulta_inicio, enviado_em")
        .in(
          "consulta_id",
          consultas.map((c) => c.id),
        )
    : { data: [] };
  const enviados = new Map(
    (enviadosRaw ?? []).map((l) => [l.consulta_id as string, l]),
  );

  const itens = consultas.map((c) => {
    const pac = umPaciente(c.pacientes);
    const registro = enviados.get(c.id);
    // Remarcada depois do envio? Então o registro antigo não vale mais.
    const enviado =
      registro !== undefined &&
      new Date(registro.consulta_inicio).getTime() === new Date(c.inicio).getTime();

    const mensagem = pac
      ? renderizarLembrete(pref?.mensagem_template, {
          nome: pac.nome,
          data: dataBR(c.inicio),
          hora: horaBR(c.inicio),
          modalidade: MODALIDADE_LABEL[c.modalidade].toLowerCase(),
          link: c.modalidade === "online" ? c.meet_link : null,
        })
      : "";
    const href = pac ? whatsappLinkComTexto(pac.telefone, mensagem) : null;

    return { c, pac, enviado, registro, href };
  });

  const pendentes = itens.filter(
    (i) => i.pac?.aceita_lembretes && i.href && !i.enviado,
  ).length;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Lembretes</h1>
        <p className="text-sm first-letter:uppercase text-slate-600">
          {dataLongaBR(`${dia}T12:00:00${BR_OFFSET}`)}
          {dia === padrao && " (padrão)"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link
          href={`/lembretes?data=${addDias(dia, -1)}`}
          className="btn btn-outline"
          aria-label="Dia anterior"
        >
          <ChevronLeft className="size-4" aria-hidden />
          <span className="hidden sm:inline">Dia anterior</span>
        </Link>
        <Link href="/lembretes" className="btn btn-outline">
          Padrão
        </Link>
        <Link
          href={`/lembretes?data=${addDias(dia, 1)}`}
          className="btn btn-outline"
          aria-label="Dia seguinte"
        >
          <span className="hidden sm:inline">Dia seguinte</span>
          <ChevronRight className="size-4" aria-hidden />
        </Link>
        <Link
          href="/configuracoes"
          className="ml-auto text-slate-500 underline"
        >
          Editar mensagem
        </Link>
      </div>

      {itens.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma consulta agendada neste dia.</p>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {itens.length} consulta{itens.length > 1 ? "s" : ""} ·{" "}
            {pendentes} lembrete{pendentes === 1 ? "" : "s"} a enviar
          </p>
          <ul className="divide-y rounded-lg border">
            {itens.map(({ c, pac, enviado, registro, href }) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="flex flex-col">
                  <span className="font-medium">
                    {horaBR(c.inicio)} · {pac?.nome ?? "Paciente"}
                  </span>
                  <span className="text-xs text-slate-500">
                    {MODALIDADE_LABEL[c.modalidade]}
                    {c.modalidade === "online" && !c.meet_link &&
                      " · link do Meet ainda não gerado"}
                  </span>
                </div>

                {!pac?.aceita_lembretes ? (
                  <span className="text-xs text-slate-400">
                    Paciente não aceita lembretes
                  </span>
                ) : !href ? (
                  <span className="text-xs text-amber-700">
                    Sem telefone válido
                  </span>
                ) : (
                  <div className="flex items-center gap-3">
                    {enviado && registro && (
                      <span className="text-xs text-green-700">
                        Enviado às {horaBR(registro.enviado_em)}
                      </span>
                    )}
                    <EnviarWhatsAppButton
                      href={href}
                      consultaId={c.id}
                      enviado={enviado}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
