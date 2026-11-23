import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cria os lançamentos "a receber" das sessões que já aconteceram (migration
 * 0035), antes de a tela ler o Financeiro. Nunca derruba a página: sem a
 * migration, com erro ou em somente leitura, só não cria nada (o cron diário
 * cobre o resto).
 */
export async function gerarLancamentosDasSessoes(supabase: SupabaseClient): Promise<void> {
  try {
    await supabase.rpc("gerar_lancamentos_sessoes");
  } catch {
    // ignora
  }
}
