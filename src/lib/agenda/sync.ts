import type { SupabaseClient } from "@supabase/supabase-js";
import {
  criarEvento,
  atualizarEvento,
  removerEvento,
  integracaoGoogleConfigurada,
  GoogleNaoConectada,
} from "@/lib/google/calendar";

type ConsultaRow = {
  id: string;
  inicio: string;
  fim: string;
  modalidade: "online" | "presencial";
  status: "agendada" | "realizada" | "cancelada";
  observacoes: string | null;
  google_event_id: string | null;
  pacientes: { nome: string } | { nome: string }[] | null;
};

function nomePaciente(p: ConsultaRow["pacientes"]): string {
  if (!p) return "Consulta";
  return Array.isArray(p) ? (p[0]?.nome ?? "Consulta") : p.nome;
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
      "id, inicio, fim, modalidade, status, observacoes, google_event_id, pacientes(nome)",
    )
    .eq("id", consultaId)
    .maybeSingle();

  if (!data) return;
  const c = data as unknown as ConsultaRow;

  const evento = {
    titulo: `Consulta — ${nomePaciente(c.pacientes)}`,
    descricao: c.observacoes,
    inicio: c.inicio,
    fim: c.fim,
    online: c.modalidade === "online",
  };

  try {
    if (c.status === "cancelada") {
      if (c.google_event_id) await removerEvento(psicologaId, c.google_event_id);
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
    if (err instanceof GoogleNaoConectada) {
      await marcar(supabase, c.id, {
        sync_status: "desativada",
        sync_erro: err.message,
      });
      return;
    }
    await marcar(supabase, c.id, {
      sync_status: "erro",
      sync_erro: String(err instanceof Error ? err.message : err).slice(0, 500),
    });
  }
}

/** Sincroniza várias consultas em sequência (usado para séries recorrentes). */
export async function sincronizarConsultas(
  supabase: SupabaseClient,
  psicologaId: string,
  ids: string[],
): Promise<void> {
  for (const id of ids) {
    await sincronizarConsulta(supabase, psicologaId, id);
  }
}
