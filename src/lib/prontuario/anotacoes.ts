import type { SupabaseClient } from "@supabase/supabase-js";
import { dataBR, dataChaveBR } from "@/lib/agenda/datas";
import { LIMITES } from "@/lib/limites";

// Anotações para a sessão (migration 0043): texto da psicóloga ligado a uma
// consulta. Lógica pura: juntar com as evoluções e levar para a próxima sessão.

export type AnotacaoSessao = {
  /** id da consulta */
  id: string;
  inicio: string;
  status: string;
  anotacoes_sessao: string;
};

type EvolucaoRef = { id: string; consulta_id: string | null; data_sessao: string };

/**
 * Cada anotação vai para a evolução da mesma sessão: a ligada à consulta ou,
 * se a evolução não está ligada a nenhuma consulta, a do mesmo dia (mesma
 * regra das evoluções pendentes). O que sobra (sessão futura, cancelada, sem
 * evolução) fica em `soltas`, na ordem recebida.
 */
export function juntarAnotacoes(
  evolucoes: EvolucaoRef[],
  anotacoes: AnotacaoSessao[],
): { porEvolucao: Map<string, AnotacaoSessao>; soltas: AnotacaoSessao[] } {
  const porEvolucao = new Map<string, AnotacaoSessao>();
  const porConsulta = new Map(evolucoes.filter((e) => e.consulta_id).map((e) => [e.consulta_id!, e]));
  const semConsultaPorDia = new Map<string, EvolucaoRef>();
  for (const e of evolucoes) {
    if (!e.consulta_id && !semConsultaPorDia.has(e.data_sessao)) semConsultaPorDia.set(e.data_sessao, e);
  }
  const soltas: AnotacaoSessao[] = [];
  for (const a of anotacoes) {
    const ligada = porConsulta.get(a.id);
    const doDia = semConsultaPorDia.get(dataChaveBR(a.inicio));
    const evo = ligada ?? (doDia && !porEvolucao.has(doDia.id) ? doDia : undefined);
    if (evo && !porEvolucao.has(evo.id)) porEvolucao.set(evo.id, a);
    else soltas.push(a);
  }
  return { porEvolucao, soltas };
}

/**
 * Texto da próxima sessão depois de "Levar para a próxima sessão": o que ela já
 * tinha + o texto trazido, com a data de origem. null = passaria do limite.
 */
export function textoLevado(origem: { inicio: string; texto: string }, destino: string | null): string | null {
  const trazido = `Da sessão de ${dataBR(origem.inicio)}:\n${origem.texto.trim()}`;
  const final = destino?.trim() ? `${destino.trim()}\n\n${trazido}` : trazido;
  return final.length > LIMITES.consulta.anotacoes ? null : final;
}

/**
 * Anotações da sessão de uma evolução: a da consulta ligada ou, sem consulta,
 * a de uma consulta do paciente no mesmo dia (horário de Brasília).
 */
export async function anotacaoDaSessao(
  supabase: SupabaseClient,
  pacienteId: string,
  sessao: { consultaId?: string | null; data?: string | null },
): Promise<{ id: string; inicio: string; texto: string } | null> {
  let q = supabase
    .from("consultas")
    .select("id, inicio, anotacoes_sessao")
    .eq("paciente_id", pacienteId)
    .is("deleted_at", null)
    .not("anotacoes_sessao", "is", null);
  if (sessao.consultaId) q = q.eq("id", sessao.consultaId);
  else if (sessao.data && /^\d{4}-\d{2}-\d{2}$/.test(sessao.data)) {
    const [a, m, d] = sessao.data.split("-").map(Number);
    const fim = new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
    q = q.gte("inicio", `${sessao.data}T00:00:00-03:00`).lt("inicio", `${fim}T00:00:00-03:00`);
  } else return null;
  const { data } = await q.order("inicio").limit(1).maybeSingle();
  if (!data?.anotacoes_sessao) return null;
  return { id: data.id as string, inicio: data.inicio as string, texto: data.anotacoes_sessao as string };
}

/**
 * Próxima consulta marcada do paciente, depois de `depoisDe` e de agora
 * (é para onde vão "Levar para a próxima sessão" e "Anotar para a próxima
 * sessão"). RLS: só da própria conta.
 */
export async function proximaSessaoDoPaciente(
  supabase: SupabaseClient,
  pacienteId: string,
  depoisDe: string,
  agora: Date = new Date(),
): Promise<{ id: string; inicio: string } | null> {
  const desde = new Date(Math.max(new Date(depoisDe).getTime(), agora.getTime())).toISOString();
  const { data } = await supabase
    .from("consultas")
    .select("id, inicio")
    .eq("paciente_id", pacienteId)
    .eq("status", "agendada")
    .is("deleted_at", null)
    .gt("inicio", desde)
    .order("inicio")
    .limit(1)
    .maybeSingle();
  return (data as { id: string; inicio: string } | null) ?? null;
}
