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

/** Máximo de consultas na lista (as mais recentes no calendário primeiro). */
export const MAX_CONSULTAS_DISPONIVEIS = 500;

const SELECT = "id, inicio, paciente_id, pacientes!inner(nome)";

/**
 * Consultas elegíveis pra vincular a um lançamento financeiro: não
 * canceladas, não excluídas, de paciente não arquivado, e que ainda não têm
 * outro pagamento (não excluído) apontando pra elas — cada consulta só pode
 * estar ligada a um lançamento por vez.
 *
 * `manterConsultaId`: ao editar um lançamento que já tem uma consulta
 * vinculada, essa consulta "já tem pagamento" (o próprio que está sendo
 * editado) e sumiria da lista por engano — esse parâmetro a mantém incluída,
 * mesmo fora do limite.
 *
 * O filtro "sem pagamento ativo" é feito no banco (anti-join do PostgREST:
 * embute só os pagamentos não excluídos e pede os que vieram vazios). Antes
 * vinham todas as consultas da conta com os pagamentos e o filtro era aqui:
 * a lista crescia para sempre e, passado o corte de 1000 linhas do PostgREST,
 * consultas sem lançamento sumiam sem aviso.
 */
export async function consultasDisponiveis(
  supabase: SupabaseClient,
  manterConsultaId?: string | null,
  limite = MAX_CONSULTAS_DISPONIVEIS,
): Promise<ConsultaDisponivel[]> {
  const [{ data }, manter] = await Promise.all([
    supabase
      .from("consultas")
      .select(`${SELECT}, pagamentos!left(id)`)
      .is("deleted_at", null)
      .is("pacientes.deleted_at", null)
      .neq("status", "cancelada")
      .is("pagamentos.deleted_at", null)
      .is("pagamentos", null)
      .order("inicio", { ascending: false })
      .limit(limite),
    manterConsultaId
      ? supabase
          .from("consultas")
          .select(SELECT)
          .eq("id", manterConsultaId)
          .is("deleted_at", null)
          .is("pacientes.deleted_at", null)
          .neq("status", "cancelada")
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const linhas = (data ?? []) as unknown as ConsultaRow[];
  const extra = manter.data as unknown as ConsultaRow | null;
  if (extra && !linhas.some((c) => c.id === extra.id)) {
    linhas.push(extra);
    linhas.sort((x, y) => y.inicio.localeCompare(x.inicio));
  }

  return linhas.map((c) => {
    const pac = Array.isArray(c.pacientes) ? (c.pacientes[0] ?? null) : c.pacientes;
    return {
      id: c.id,
      inicio: c.inicio,
      paciente_id: c.paciente_id,
      pacienteNome: pac?.nome ?? "Paciente",
    };
  });
}
