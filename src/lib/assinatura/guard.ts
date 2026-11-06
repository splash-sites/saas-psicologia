import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { permiteEscrita, type Assinatura } from "./types";

export type StatusAssinatura = {
  assinatura: Assinatura | null;
  enforcementAtivo: boolean;
  somenteLeitura: boolean;
};

/** Função do banco ainda não criada (migration não aplicada): PostgREST PGRST202. */
export function funcaoAusente(error: { code?: string } | null | undefined): boolean {
  return error?.code === "PGRST202";
}

/**
 * Busca a assinatura da psicóloga logada + se a trava está ligada.
 *
 * Uma consulta só: rpc status_assinatura() (migration 0023). Enquanto ela não
 * estiver aplicada no banco, cai nas duas consultas de antes — o deploy do
 * código pode vir antes da migration sem quebrar nada.
 *
 * cache(): layout (faixa de aviso) + página /assinatura da mesma requisição
 * consultam uma vez só. O rpc é POST, que o Next não deduplica sozinho.
 */
export const buscarStatusAssinatura = cache(async (
  psicologaId: string,
): Promise<StatusAssinatura> => {
  const supabase = await createClient();
  let assinatura: Assinatura | null;
  let enforcement: boolean;

  const { data, error } = await supabase.rpc("status_assinatura");
  if (!funcaoAusente(error)) {
    const status = (data ?? {}) as { assinatura?: Assinatura | null; enforcement?: boolean };
    assinatura = status.assinatura ?? null;
    enforcement = Boolean(status.enforcement);
  } else {
    const [{ data: linha }, { data: enforcementAtivo }] = await Promise.all([
      supabase.from("assinaturas").select("*").eq("psicologa_id", psicologaId).maybeSingle(),
      supabase.rpc("assinatura_enforcement_ativo"),
    ]);
    assinatura = linha as Assinatura | null;
    enforcement = Boolean(enforcementAtivo);
  }

  return {
    assinatura,
    enforcementAtivo: enforcement,
    somenteLeitura: assinatura ? !permiteEscrita(assinatura, enforcement) : false,
  };
});

export const MSG_SOMENTE_LEITURA =
  "Sua assinatura não está em dia, e o painel está em modo somente leitura. Acesse Assinatura no menu para assinar ou regularizar.";
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

  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  const { data: permite } = id
    ? await supabase.rpc("assinatura_permite_escrita", { p_psicologa_id: id })
    : { data: null };
  return permite === false ? MSG_SOMENTE_LEITURA : MSG_SEM_PERMISSAO;
}
