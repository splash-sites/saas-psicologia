import type { SupabaseClient } from "@supabase/supabase-js";
import {
  criarEvento,
  atualizarEvento,
  removerEvento,
  integracaoGoogleConfigurada,
  GoogleNaoConectada,
  ehErroDeEscopo,
  MSG_SEM_PERMISSAO_CALENDAR,
} from "@/lib/google/calendar";
import type { ConsultaStatus } from "./types";

type PacienteEmbed = {
  nome: string;
  email: string | null;
  aceita_lembretes: boolean;
};

type ConsultaRow = {
  id: string;
  inicio: string;
  fim: string;
  modalidade: "online" | "presencial";
  status: ConsultaStatus;
  google_event_id: string | null;
  pacientes: PacienteEmbed | PacienteEmbed[] | null;
};

/**
 * Quem o Google avisa. Consulta que já terminou (registrada ou mexida depois)
 * vira só registro na agenda da psicóloga: sem convidado e sem e-mail —
 * convite de uma sessão de semanas atrás confunde o paciente.
 */
export function conviteDoPaciente(
  c: { fim: string },
  pac: { email: string | null; aceita_lembretes: boolean } | null,
  conviteLigado: boolean,
  agora: Date = new Date(),
): { convidadoEmail: string | null; notificar: boolean } {
  const jaPassou = new Date(c.fim).getTime() <= agora.getTime();
  if (jaPassou) return { convidadoEmail: null, notificar: false };
  return {
    convidadoEmail: conviteLigado && pac?.aceita_lembretes && pac.email ? pac.email : null,
    notificar: true,
  };
}

function paciente(p: ConsultaRow["pacientes"]): PacienteEmbed | null {
  if (!p) return null;
  return Array.isArray(p) ? (p[0] ?? null) : p;
}

async function marcar(
  supabase: SupabaseClient,
  id: string,
  campos: Record<string, unknown>,
) {
  await supabase
    .from("consultas")
    .update({ ...campos, sync_em: new Date().toISOString() })
    .eq("id", id);
}

/**
 * Empurra uma consulta para o Google Calendar da psicóloga (mão única).
 * Best-effort: nunca lança — grava o resultado em sync_status/sync_erro.
 */
export async function sincronizarConsulta(
  supabase: SupabaseClient,
  psicologaId: string,
  consultaId: string,
): Promise<void> {
  if (!integracaoGoogleConfigurada()) {
    await marcar(supabase, consultaId, {
      sync_status: "desativada",
      sync_erro: null,
    });
    return;
  }

  const { data } = await supabase
    .from("consultas")
    .select(
      "id, inicio, fim, modalidade, status, google_event_id, pacientes(nome, email, aceita_lembretes)",
    )
    .eq("id", consultaId)
    .maybeSingle();

  if (!data) return;
  const c = data as unknown as ConsultaRow;
  const pac = paciente(c.pacientes);

  // Convite ao paciente (e-mail do Google Agenda): só se ele aceita lembretes,
  // tem e-mail, e a psicóloga não desligou o convite. Sem linha de preferência
  // = padrão ligado.
  const { data: pref } = await supabase
    .from("preferencias_lembrete")
    .select("convite_google")
    .eq("psicologa_id", psicologaId)
    .maybeSingle();
  const conviteLigado = pref?.convite_google ?? true;
  const { convidadoEmail, notificar } = conviteDoPaciente(c, pac, conviteLigado);

  // O evento é visível ao convidado: sem observações da consulta nem nada
  // clínico. Só nome do paciente, horário e Meet.
  const evento = {
    titulo: `Consulta — ${pac?.nome ?? "Paciente"}`,
    inicio: c.inicio,
    fim: c.fim,
    online: c.modalidade === "online",
    convidadoEmail,
    notificar,
  };

  try {
    if (c.status === "cancelada") {
      if (c.google_event_id) await removerEvento(psicologaId, c.google_event_id, notificar);
      await marcar(supabase, c.id, {
        google_event_id: null,
        meet_link: null,
        sync_status: "sincronizada",
        sync_erro: null,
      });
      return;
    }

    const r = c.google_event_id
      ? await atualizarEvento(psicologaId, c.google_event_id, evento)
      : await criarEvento(psicologaId, evento);

    await marcar(supabase, c.id, {
      google_event_id: r.googleEventId,
      meet_link: r.meetLink,
      sync_status: "sincronizada",
      sync_erro: null,
    });
  } catch (err) {
    const mensagem = String(err instanceof Error ? err.message : err);
    if (err instanceof GoogleNaoConectada) {
      await marcar(supabase, c.id, {
        sync_status: "desativada",
        sync_erro: err.message,
      });
      return;
    }
    // 403 por token sem a permissão da Agenda: mensagem clara, sem o JSON cru.
    if (ehErroDeEscopo(mensagem)) {
      await marcar(supabase, c.id, {
        sync_status: "desativada",
        sync_erro: MSG_SEM_PERMISSAO_CALENDAR,
      });
      return;
    }
    await marcar(supabase, c.id, {
      sync_status: "erro",
      sync_erro: mensagemErroGoogle(mensagem),
    });
  }
}

/**
 * O que mostrar à psicóloga quando o Google falha. Nunca o erro cru: ele vem
 * em inglês, com o JSON da API, e pode repetir dados do evento (nome do
 * paciente) — fica fora da tela e do banco.
 */
export function mensagemErroGoogle(mensagem: string): string {
  const tenteDeNovo = "Use “Sincronizar agora” para tentar de novo.";
  if (/: (429|5\d\d)\b|fetch failed|ECONN|ETIMEDOUT|ENOTFOUND|network|socket/i.test(mensagem)) {
    return `O Google Agenda não respondeu agora. ${tenteDeNovo}`;
  }
  if (/renovar token/i.test(mensagem)) {
    return `Não foi possível falar com o Google agora. ${tenteDeNovo}`;
  }
  return `O Google Agenda recusou esta consulta. ${tenteDeNovo} Se continuar, fale com o suporte.`;
}

// Uma série pode ter até 52 consultas, cada uma com ~5 idas e voltas (banco,
// token OAuth, Calendar API). Em série isso passava fácil do timeout da função
// serverless; com poucas em paralelo fica rápido sem estourar a cota do Google.
const SYNC_EM_PARALELO = 5;

/** Roda `fn` em todos os itens, no máximo `limite` ao mesmo tempo. */
export async function emParalelo<T>(
  itens: T[],
  limite: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < itens.length) {
      const item = itens[proximo++];
      await fn(item);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limite, itens.length) }, trabalhador),
  );
}

/** Sincroniza várias consultas (usado para séries recorrentes). */
export async function sincronizarConsultas(
  supabase: SupabaseClient,
  psicologaId: string,
  ids: string[],
): Promise<void> {
  await emParalelo(ids, SYNC_EM_PARALELO, (id) =>
    sincronizarConsulta(supabase, psicologaId, id),
  );
}
