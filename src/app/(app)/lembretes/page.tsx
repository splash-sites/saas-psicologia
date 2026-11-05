import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { redirect } from "next/navigation";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { EstadoVazio } from "@/components/EstadoVazio";
import { NavegacaoPeriodo } from "@/components/NavegacaoPeriodo";
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
import { linkDaConsulta } from "@/lib/agenda/linkOnline";
import { GOOGLE_AGENDA_ATIVA } from "@/lib/google/flag";
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

  const { data: psicologa } = await supabase
    .from("psicologas")
    .select("link_atendimento_online")
    .eq("id", user.id)
    .maybeSingle();
  const consultas = ((consultasRaw ?? []) as unknown as Linha[]).map((c) => ({
    ...c,
    meet_link: linkDaConsulta(c, psicologa?.link_atendimento_online),
  }));

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
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <CabecalhoPagina
        titulo="Lembretes"
        periodo={
          <NavegacaoPeriodo
            anterior={{ href: `/lembretes?data=${addDias(dia, -1)}`, rotulo: "Dia anterior" }}
            atual={{ href: "/lembretes", rotulo: "Padrão" }}
            proximo={{ href: `/lembretes?data=${addDias(dia, 1)}`, rotulo: "Dia seguinte" }}
            periodo={
              <>
                {dataLongaBR(`${dia}T12:00:00${BR_OFFSET}`)}
                {dia === padrao && <span className="font-normal text-slate-500"> (padrão)</span>}
              </>
            }
          />
        }
        acoes={
          <Link href="/configuracoes" className="btn btn-outline">
            Editar mensagem
          </Link>
        }
      />

      {itens.length === 0 ? (
        <EstadoVazio
          icon={MessageCircle}
          titulo="Nenhuma consulta agendada neste dia"
          texto="Use as setas para ver outro dia."
        />
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
                className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <div className="flex flex-col">
                  <span className="font-medium">
                    {horaBR(c.inicio)} · <span data-sensivel>{pac?.nome ?? "Paciente"}</span>
                  </span>
                  <span className="text-xs text-slate-500">
                    {MODALIDADE_LABEL[c.modalidade]}
                    {c.modalidade === "online" && !c.meet_link &&
                      (GOOGLE_AGENDA_ATIVA
                        ? " · link do Meet ainda não gerado"
                        : " · sem link de atendimento (cadastre em Configurações)")}
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
