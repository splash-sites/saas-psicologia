import type { SupabaseClient } from "@supabase/supabase-js";
import { escopoTemCalendar, integracaoGoogleConfigurada } from "@/lib/google/calendar";

/**
 * De onde vem o link do Meet de um evento (0047): Google Agenda conectado
 * (o Meet é criado junto com o evento), senão o link fixo de atendimento
 * online, senão nenhum (a opção fica desabilitada no formulário).
 * Escopo nulo = token antigo, conta como conectado (mesma regra do Painel).
 */
export async function origemDoMeet(
  supabase: SupabaseClient,
  psicologaId: string,
): Promise<"google" | "fixo" | null> {
  const { data } = await supabase
    .from("psicologas")
    .select("link_atendimento_online, google_oauth_tokens(escopo)")
    .eq("id", psicologaId)
    .maybeSingle();
  const t = data?.google_oauth_tokens as { escopo: string | null } | { escopo: string | null }[] | null | undefined;
  const token = Array.isArray(t) ? t[0] : t;
  if (integracaoGoogleConfigurada() && token && (token.escopo == null || escopoTemCalendar(token.escopo))) {
    return "google";
  }
  return data?.link_atendimento_online ? "fixo" : null;
}
