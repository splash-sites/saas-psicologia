// Entrega F (0039): se a próxima consulta marcada do paciente cai em feriado
// ou ponto facultativo, a sessão imediatamente anterior avisa. Some sozinho
// quando a próxima é remarcada, cancelada (ou cancelada por um evento) ou
// quando a psicóloga marca "Já combinei" (dispensa só aquela data).

import type { SupabaseClient } from "@supabase/supabase-js";
import { dataChaveBR } from "./datas";
import { feriadosDaPsicologa, type Feriado, type PreferenciaFeriados } from "@/lib/feriados";

export type SessaoBase = { id: string; inicio: string; paciente_id: string | null; status: string };
export type ProximaSessao = {
  id: string;
  paciente_id: string;
  inicio: string;
  aviso_feriado_dispensado_para: string | null;
};
export type AvisoProxima = { proxima: ProximaSessao; feriado: Feriado };

/** Busca a próxima sessão é só até aqui à frente (série quinzenal/mensal cabe). */
const JANELA_DIAS = 120;

/** Próxima consulta agendada do mesmo paciente, depois de cada sessão dada. */
export async function proximasSessoes(
  supabase: SupabaseClient,
  sessoes: SessaoBase[],
): Promise<Map<string, ProximaSessao>> {
  const r = new Map<string, ProximaSessao>();
  const base = sessoes.filter((s) => s.paciente_id && (s.status === "agendada" || s.status === "realizada"));
  if (base.length === 0) return r;
  const pacientes = [...new Set(base.map((s) => s.paciente_id as string))];
  const desde = base.reduce((m, s) => (s.inicio < m ? s.inicio : m), base[0].inicio);
  const ate = new Date(
    Math.max(...base.map((s) => new Date(s.inicio).getTime())) + JANELA_DIAS * 86_400_000,
  ).toISOString();

  const { data } = await supabase
    .from("consultas")
    .select("id, paciente_id, inicio, aviso_feriado_dispensado_para")
    .in("paciente_id", pacientes)
    .eq("status", "agendada")
    .is("deleted_at", null)
    .gt("inicio", desde)
    .lt("inicio", ate)
    .order("inicio")
    .limit(1000);
  const futuras = (data ?? []) as ProximaSessao[];

  for (const s of base) {
    const prox = futuras.find((f) => f.paciente_id === s.paciente_id && f.inicio > s.inicio && f.id !== s.id);
    if (prox) r.set(s.id, prox);
  }
  return r;
}

/** Aviso, se a próxima cai em feriado e ainda não foi combinada para essa data. */
export function avisoDaProxima(proxima: ProximaSessao | undefined, pref: PreferenciaFeriados): AvisoProxima | null {
  if (!proxima) return null;
  const dia = dataChaveBR(proxima.inicio);
  if (proxima.aviso_feriado_dispensado_para === dia) return null;
  const feriado = feriadosDaPsicologa([dia], pref).get(dia);
  return feriado ? { proxima, feriado } : null;
}
