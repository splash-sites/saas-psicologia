export const PACIENTE_STATUS = ["ativo", "inativo", "alta"] as const;
export type PacienteStatus = (typeof PACIENTE_STATUS)[number];

export const PACIENTE_STATUS_LABEL: Record<PacienteStatus, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  alta: "Alta",
};

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
