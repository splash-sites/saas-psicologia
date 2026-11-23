export type Evolucao = {
  id: string;
  psicologa_id: string;
  paciente_id: string;
  consulta_id: string | null;
  data_sessao: string;
  // Nenhum é obrigatório (basta um campo preenchido, notas privadas incluídas).
  demanda: string | null;
  procedimentos: string | null;
  resultados: string | null;
  encaminhamentos: string | null;
  notas_privadas: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_motivo: string | null;
};

export const CAMPOS_EVOLUCAO = [
  {
    nome: "demanda",
    rotulo: "Avaliação da demanda / objetivos",
    ajuda: "O que foi trazido pela pessoa e os objetivos do trabalho nesta sessão.",
  },
  {
    nome: "procedimentos",
    rotulo: "Procedimentos aplicados",
    ajuda: "Registro sintético do que foi trabalhado e das técnicas utilizadas.",
  },
  {
    nome: "resultados",
    rotulo: "Resultados obtidos",
    ajuda: "Evolução observada, respostas e desdobramentos na sessão.",
  },
  {
    nome: "encaminhamentos",
    rotulo: "Encaminhamentos / decisões",
    ajuda: "Combinações, encaminhamentos e decisões tomadas.",
  },
] as const;

/** Só os campos da evolução que foram preenchidos (tela e PDF não mostram os vazios). */
export function camposPreenchidos(e: Pick<Evolucao, (typeof CAMPOS_EVOLUCAO)[number]["nome"]>) {
  return CAMPOS_EVOLUCAO.filter((c) => e[c.nome]?.trim());
}

/** Prévia da evolução na lista: o primeiro campo preenchido. */
export function previaEvolucao(e: Pick<Evolucao, (typeof CAMPOS_EVOLUCAO)[number]["nome"] | "notas_privadas">): string {
  const campo = camposPreenchidos(e)[0];
  if (campo) return e[campo.nome] ?? "";
  return e.notas_privadas?.trim() ? "Só notas técnicas privadas." : "";
}
