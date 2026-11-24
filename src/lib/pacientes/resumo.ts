import type { SupabaseClient } from "@supabase/supabase-js";
import { hojeBR } from "@/lib/agenda/datas";
import { statusExibicao, type StatusExibicao } from "@/lib/financeiro/types";

// Resumo da ficha do paciente (2026-11-24, decisões do usuário): todo o
// tratamento. "Realizada" = sessão que já passou e não é falta nem cancelada
// (muita gente não clica em "Marcar realizada"). Financeiro com as regras do
// Financeiro (0037): a receber = já aconteceu e não pago; previsto = sessões
// futuras com valor, uma vez cada.

export type LancamentoPaciente = {
  id: string;
  valor: number;
  dataReferencia: string;
  vencimento: string;
  dataPagamento: string | null;
  formaPagamento: string | null;
  status: StatusExibicao;
};

export type ResumoPaciente = {
  proxima: { id: string; inicio: string } | null;
  realizadas: number;
  faltas: number;
  canceladas: number;
  recebido: number;
  aReceber: number;
  atrasados: number;
  previsto: number;
  previstoSessoes: number;
  lancamentos: LancamentoPaciente[];
};

type Pag = {
  id: string;
  consulta_id: string | null;
  valor: number;
  status: "pendente" | "pago";
  vencimento: string;
  data_referencia: string;
  data_pagamento: string | null;
  forma_pagamento: string | null;
  consultas: { fim: string } | { fim: string }[] | null;
};

const um = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export async function resumoDoPaciente(supabase: SupabaseClient, pacienteId: string): Promise<ResumoPaciente> {
  const agora = new Date();
  const agoraISO = agora.toISOString();
  const hoje = hojeBR();
  const consultas = () => supabase.from("consultas").select("id", { count: "exact", head: true }).eq("paciente_id", pacienteId).is("deleted_at", null);

  const [realizadas, faltas, canceladas, { data: proxima }, { data: pags }, { data: futuras }] = await Promise.all([
    consultas().or(`status.eq.realizada,and(status.eq.agendada,fim.lt.${agoraISO})`),
    consultas().eq("status", "falta"),
    consultas().eq("status", "cancelada"),
    supabase
      .from("consultas")
      .select("id, inicio")
      .eq("paciente_id", pacienteId)
      .is("deleted_at", null)
      .eq("status", "agendada")
      .gt("inicio", agoraISO)
      .order("inicio")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("pagamentos")
      .select("id, consulta_id, valor, status, vencimento, data_referencia, data_pagamento, forma_pagamento, consultas(fim)")
      .eq("paciente_id", pacienteId)
      .is("deleted_at", null)
      .order("data_referencia", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("consultas")
      .select("id, valor")
      .eq("paciente_id", pacienteId)
      .is("deleted_at", null)
      .eq("status", "agendada")
      .not("valor", "is", null)
      .gt("fim", agoraISO)
      .limit(1000),
  ]);

  const lista = (pags ?? []) as unknown as Pag[];
  let recebido = 0;
  let aReceber = 0;
  let atrasados = 0;
  let previsto = 0;
  let previstoSessoes = 0;
  for (const p of lista) {
    const v = Number(p.valor);
    if (p.status === "pago") {
      recebido += v;
      continue;
    }
    const c = um(p.consultas);
    const aconteceu = c ? new Date(c.fim).getTime() <= agora.getTime() : p.data_referencia <= hoje;
    if (aconteceu) {
      aReceber += v;
      if (p.vencimento < hoje) atrasados++;
    } else {
      previsto += v;
      if (p.consulta_id) previstoSessoes++;
    }
  }
  const lancadas = new Set(lista.map((p) => p.consulta_id).filter(Boolean));
  for (const c of futuras ?? []) {
    if (lancadas.has(c.id as string)) continue;
    previsto += Number(c.valor);
    previstoSessoes++;
  }

  return {
    proxima: (proxima as { id: string; inicio: string } | null) ?? null,
    realizadas: realizadas.count ?? 0,
    faltas: faltas.count ?? 0,
    canceladas: canceladas.count ?? 0,
    recebido,
    aReceber,
    atrasados,
    previsto,
    previstoSessoes,
    lancamentos: lista.map((p) => ({
      id: p.id,
      valor: Number(p.valor),
      dataReferencia: p.data_referencia,
      vencimento: p.vencimento,
      dataPagamento: p.data_pagamento,
      formaPagamento: p.forma_pagamento,
      status: statusExibicao(p, hoje),
    })),
  };
}
