import type { SupabaseClient } from "@supabase/supabase-js";

// Leitura do A receber: lançamentos pendentes até um dia e se a sessão já
// aconteceu.

export type Pendente = {
  id: string;
  paciente_id: string;
  valor: number;
  status: "pendente";
  data_referencia: string;
  vencimento: string;
  data_pagamento: null;
  consultas: { fim: string } | { fim: string }[] | null;
  pacientes: { nome: string } | { nome: string }[] | null;
};

const um = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** Lançamentos pendentes com competência até `ate` (inclusive). */
export async function pendentesAte(supabase: SupabaseClient, ate: string): Promise<Pendente[]> {
  const { data } = await supabase
    .from("pagamentos")
    .select("id, paciente_id, valor, status, data_referencia, vencimento, data_pagamento, consultas(fim), pacientes(nome)")
    .eq("status", "pendente")
    .is("deleted_at", null)
    .lte("data_referencia", ate)
    .order("data_referencia")
    .limit(1000);
  return (data ?? []) as unknown as Pendente[];
}

/** Já aconteceu: sessão terminada, ou lançamento sem sessão com data até hoje. */
export function realizado(p: Pendente, hoje: string, agora: number): boolean {
  const c = um(p.consultas);
  return c ? new Date(c.fim).getTime() <= agora : p.data_referencia <= hoje;
}
