export type Evolucao = {
  id: string;
  psicologa_id: string;
  paciente_id: string;
  consulta_id: string | null;
  data_sessao: string;
  demanda: string;
  procedimentos: string;
  resultados: string;
  encaminhamentos: string;
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
