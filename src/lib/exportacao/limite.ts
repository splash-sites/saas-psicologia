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

/**
 * Erro de um download (PDF/ZIP) em português. O link abre direto no
 * navegador, então a resposta é a frase que a psicóloga vai ler, não JSON.
 */
export function respostaErroDownload(status: number, texto: string, headers: Record<string, string> = {}): Response {
  return new Response(texto, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...headers },
  });
}

/** Resposta para quem passou do limite. */
export function respostaLimiteExportacao(): Response {
  return respostaErroDownload(429, "Você já exportou há pouco. Aguarde um minuto e tente de novo.", {
    "Retry-After": "60",
  });
}

export const MSG_DOWNLOAD_SEM_LOGIN = "Sua sessão terminou. Entre de novo no Gradatim e tente baixar outra vez.";
export const MSG_DOWNLOAD_NAO_ENCONTRADO = "Não encontramos este paciente. Ele pode ter sido arquivado.";
export const MSG_DOWNLOAD_FALHOU = "Não foi possível gerar o arquivo agora. Tente de novo em instantes.";
