import type { SupabaseClient } from "@supabase/supabase-js";

// O RLS já filtra pacientes pela psicóloga logada: se a busca não acha, o
// paciente não é dela (ou foi arquivado). A migration 0012 garante o mesmo no
// banco; esta checagem existe para devolver uma mensagem clara em vez do erro
// de policy, que a tela traduziria como "assinatura pendente".
export async function pacientePertenceAPsicologa(
  supabase: SupabaseClient,
  pacienteId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("pacientes")
    .select("id")
    .eq("id", pacienteId)
    .is("deleted_at", null)
    .maybeSingle();
  return Boolean(data);
}
