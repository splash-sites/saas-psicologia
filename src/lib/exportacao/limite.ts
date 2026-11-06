import type { SupabaseClient } from "@supabase/supabase-js";

export type TipoExportacao = "conta" | "prontuario";

/**
 * Registra a exportação se estiver dentro do limite por minuto (rpc
 * registrar_exportacao, migration 0026: conta inteira 1, prontuário 10).
 * Sem a migration no banco, libera — o deploy pode vir antes dela.
 * Erro inesperado também libera: o limite protege o banco, não pode impedir a
 * psicóloga de exportar o próprio prontuário (guarda de 5 anos).
 */
export async function registrarExportacao(
  supabase: SupabaseClient,
  tipo: TipoExportacao,
  pacienteId?: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("registrar_exportacao", {
    p_tipo: tipo,
    p_paciente_id: pacienteId ?? null,
  });
  if (error) return true; // inclui funcaoAusente(error): migration ainda não aplicada
  return data !== false;
}

/** Resposta para quem passou do limite (o link abre direto no navegador). */
export function respostaLimiteExportacao(): Response {
  return new Response(
    "Você já exportou há pouco. Aguarde um minuto e tente de novo.",
    {
      status: 429,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "60" },
    },
  );
}
