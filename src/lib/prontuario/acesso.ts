import type { SupabaseClient } from "@supabase/supabase-js";

export type TipoAcesso = "ficha" | "evolucoes" | "evolucao";

/**
 * Registra que a psicóloga abriu parte do prontuário de um paciente (tabela
 * acessos_prontuario, migration 0029): quando, o quê e de qual paciente — nada
 * do conteúdo. O RLS só aceita paciente/evolução da própria conta.
 *
 * Nunca impede a tela de abrir: erro (inclusive migration ainda não aplicada)
 * é ignorado, e nada do erro vai para o log.
 */
export async function registrarAcesso(
  supabase: SupabaseClient,
  tipo: TipoAcesso,
  pacienteId: string,
  evolucaoId?: string,
): Promise<void> {
  try {
    await supabase.from("acessos_prontuario").insert({
      tipo,
      paciente_id: pacienteId,
      evolucao_id: tipo === "evolucao" ? (evolucaoId ?? null) : null,
    });
  } catch {
    // de propósito: o registro não pode derrubar a página
  }
}
