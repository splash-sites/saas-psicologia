import type { SupabaseClient } from "@supabase/supabase-js";
import { permiteEscrita, type Assinatura } from "./types";

export type StatusAssinatura = {
  assinatura: Assinatura | null;
  enforcementAtivo: boolean;
  somenteLeitura: boolean;
};

/** Busca a assinatura da psicóloga logada + se a trava está ligada. */
export async function buscarStatusAssinatura(
  supabase: SupabaseClient,
  psicologaId: string,
): Promise<StatusAssinatura> {
  const [{ data: assinatura }, { data: enforcementAtivo }] = await Promise.all([
    supabase.from("assinaturas").select("*").eq("psicologa_id", psicologaId).maybeSingle(),
    supabase.rpc("assinatura_enforcement_ativo"),
  ]);

  const enforcement = Boolean(enforcementAtivo);
  return {
    assinatura: assinatura as Assinatura | null,
    enforcementAtivo: enforcement,
    somenteLeitura: assinatura ? !permiteEscrita(assinatura, enforcement) : false,
  };
}

/**
 * Toda escrita bloqueada pela trava de assinatura (RLS) chega como violação
 * de policy (SQLSTATE 42501). Convertida numa mensagem que explica o motivo,
 * em vez do "não foi possível salvar" genérico.
 */
export function mensagemErroEscrita(
  error: { code?: string } | null | undefined,
  mensagemPadrao: string,
): string {
  if (error?.code === "42501") {
    return "Sua assinatura está com o pagamento pendente — o painel está em modo somente leitura até regularizar. Acesse Assinatura no menu para resolver.";
  }
  return mensagemPadrao;
}
