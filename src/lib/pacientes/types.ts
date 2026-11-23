export const PACIENTE_STATUS = ["ativo", "inativo", "alta"] as const;
export type PacienteStatus = (typeof PACIENTE_STATUS)[number];

export const PACIENTE_STATUS_LABEL: Record<PacienteStatus, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  alta: "Alta",
};

export const FORMAS_COBRANCA = ["sessao", "mensal"] as const;
export type FormaCobranca = (typeof FORMAS_COBRANCA)[number];
export const DIA_COBRANCA_PADRAO = 10;

/** Sugestões do campo "relação" (texto livre). */
export const SUGESTOES_RELACAO = ["Mãe", "Pai", "Cônjuge", "Irmã", "Irmão", "Filha", "Filho", "Amiga", "Amigo"] as const;

export function descricaoCobranca(p: Pick<Paciente, "cobranca" | "cobranca_dia">): string {
  return p.cobranca === "mensal" ? `Mensal, vence no dia ${p.cobranca_dia} do mês seguinte` : "Por sessão";
}

export type Paciente = {
  id: string;
  psicologa_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  cpf: string | null;
  endereco: string | null;
  status: PacienteStatus;
  observacoes: string | null;
  aceita_lembretes: boolean;
  /** Gravada pelo banco ao marcar o aceite (migration 0029); null = não aceita ou aceite anterior ao registro. */
  lembretes_aceitos_em: string | null;
  // Contato de emergência e responsável financeiro (migration 0034).
  emergencia_nome: string | null;
  emergencia_telefone: string | null;
  emergencia_relacao: string | null;
  responsavel_nome: string | null;
  responsavel_cpf: string | null;
  responsavel_telefone: string | null;
  responsavel_relacao: string | null;
  /** Vazio = atendimento social (nada vem preenchido). */
  valor_sessao: number | null;
  cobranca: FormaCobranca;
  /** Dia do mês seguinte em que vencem as sessões, na cobrança mensal. */
  cobranca_dia: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Anamnese = {
  id: string;
  paciente_id: string;
  psicologa_id: string;
  demanda: string | null;
  objetivos: string | null;
  historico: string | null;
  created_at: string;
  updated_at: string;
};
