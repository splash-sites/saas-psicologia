import type { SupabaseClient } from "@supabase/supabase-js";

export type ConsultaDisponivel = {
  id: string;
  inicio: string;
  paciente_id: string;
  pacienteNome: string;
};

type ConsultaRow = {
  id: string;
  inicio: string;
  paciente_id: string;
  pacientes: { nome: string } | { nome: string }[] | null;
};

/**
 * Consultas elegíveis pra vincular a um lançamento financeiro: não
 * canceladas, não excluídas, e que ainda não têm outro pagamento (não
 * excluído) apontando pra elas — cada consulta só pode estar ligada a um
 * lançamento por vez.
 *
 * `manterConsultaId`: ao editar um lançamento que já tem uma consulta
 * vinculada, essa consulta "já tem pagamento" (o próprio que está sendo
 * editado) e sumiria da lista por engano — esse parâmetro a mantém incluída.
 */
export async function consultasDisponiveis(
  supabase: SupabaseClient,
  manterConsultaId?: string | null,
): Promise<ConsultaDisponivel[]> {
  const [{ data: consultasRaw }, { data: vinculadasRaw }] = await Promise.all([
    supabase
      .from("consultas")
      .select("id, inicio, paciente_id, pacientes(nome)")
      .is("deleted_at", null)
      .neq("status", "cancelada")
      .order("inicio", { ascending: false }),
    supabase
      .from("pagamentos")
      .select("consulta_id")
      .is("deleted_at", null)
      .not("consulta_id", "is", null),
  ]);

  const vinculadas = new Set(
    (vinculadasRaw ?? [])
      .map((p) => p.consulta_id as string)
      .filter((cid) => cid !== manterConsultaId),
  );

  return ((consultasRaw ?? []) as unknown as ConsultaRow[])
    .filter((c) => !vinculadas.has(c.id))
    .map((c) => {
      const pac = Array.isArray(c.pacientes) ? (c.pacientes[0] ?? null) : c.pacientes;
      return {
        id: c.id,
        inicio: c.inicio,
        paciente_id: c.paciente_id,
        pacienteNome: pac?.nome ?? "Paciente",
      };
    });
}
