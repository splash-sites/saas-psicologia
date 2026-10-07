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

export const MSG_SOMENTE_LEITURA =
  "Sua assinatura está com o pagamento pendente — o painel está em modo somente leitura até regularizar. Acesse Assinatura no menu para resolver.";
export const MSG_SEM_PERMISSAO = "Você não tem permissão para alterar este registro.";

/**
 * Toda escrita barrada por policy (RLS) chega como SQLSTATE 42501 — tanto pela
 * trava de assinatura quanto por outra regra (ex: registro de outra conta).
 * Só nesse caminho de erro, confere no banco se a trava é a causa, pra não
 * mandar a psicóloga pagar uma assinatura que está em dia.
 */
export async function mensagemErroEscrita(
  supabase: SupabaseClient,
  error: { code?: string } | null | undefined,
  mensagemPadrao: string,
): Promise<string> {
  if (error?.code !== "42501") return mensagemPadrao;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: permite } = user
    ? await supabase.rpc("assinatura_permite_escrita", { p_psicologa_id: user.id })
    : { data: null };
  return permite === false ? MSG_SOMENTE_LEITURA : MSG_SEM_PERMISSAO;
}
