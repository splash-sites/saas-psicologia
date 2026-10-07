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
  pagamentos: { id: string; deleted_at: string | null }[] | null;
};

/**
 * Consultas elegíveis pra vincular a um lançamento financeiro: não
 * canceladas, não excluídas, de paciente não arquivado, e que ainda não têm
 * outro pagamento (não excluído) apontando pra elas — cada consulta só pode
 * estar ligada a um lançamento por vez.
 *
 * `manterConsultaId`: ao editar um lançamento que já tem uma consulta
 * vinculada, essa consulta "já tem pagamento" (o próprio que está sendo
 * editado) e sumiria da lista por engano — esse parâmetro a mantém incluída.
 *
 * Os pagamentos vêm embutidos em cada consulta (e não numa lista separada de
 * todos os pagamentos da conta): o PostgREST corta respostas em 1000 linhas, e
 * com mais que isso consultas já pagas voltariam a aparecer como disponíveis.
 */
export async function consultasDisponiveis(
  supabase: SupabaseClient,
  manterConsultaId?: string | null,
): Promise<ConsultaDisponivel[]> {
  const { data } = await supabase
    .from("consultas")
    .select("id, inicio, paciente_id, pacientes!inner(nome), pagamentos(id, deleted_at)")
    .is("deleted_at", null)
    .is("pacientes.deleted_at", null)
    .neq("status", "cancelada")
    .order("inicio", { ascending: false });

  return ((data ?? []) as unknown as ConsultaRow[])
    .filter(
      (c) =>
        c.id === manterConsultaId ||
        !(c.pagamentos ?? []).some((p) => p.deleted_at === null),
    )
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
