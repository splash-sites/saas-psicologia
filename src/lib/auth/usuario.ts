import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type UsuarioAtual = { id: string; email: string | null };

/**
 * Usuária logada, validando o token localmente (assinatura + validade pelo
 * JWKS do Supabase) em vez de perguntar ao servidor de Auth.
 *
 * Por quê: getUser() faz uma chamada ao GoTrue, que consulta o Postgres, a
 * cada uso — e cada página chamava 2-3 vezes (proxy, layout, página). No teste
 * de carga isso esgotou as conexões do GoTrue com o banco e as falhas viravam
 * "não logada": a psicóloga era jogada para o /login no meio do uso.
 *
 * Trade-off (decisão do usuário, 2026-10-07): uma sessão encerrada em outro
 * lugar continua valendo até o token expirar (até 1 h). O acesso aos dados já
 * funcionava assim — o RLS também só confere a assinatura do token.
 *
 * cache(): layout + página + action da mesma requisição validam uma vez só.
 */
export const usuarioAtual = cache(async (): Promise<UsuarioAtual | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
});
