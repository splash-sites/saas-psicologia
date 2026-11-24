export const MODALIDADES = ["online", "presencial"] as const;
export type Modalidade = (typeof MODALIDADES)[number];

export const CONSULTA_STATUS = [
  "agendada",
  "realizada",
  "falta",
  "cancelada",
] as const;
export type ConsultaStatus = (typeof CONSULTA_STATUS)[number];

export const RECORRENCIAS = [
  "nenhuma",
  "semanal",
  "quinzenal",
  "mensal",
] as const;
export type Recorrencia = (typeof RECORRENCIAS)[number];

export const RECORRENCIA_LABEL: Record<Recorrencia, string> = {
  nenhuma: "Sem recorrência",
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
};

export const MODALIDADE_LABEL: Record<Modalidade, string> = {
  online: "Online",
  presencial: "Presencial",
};

export const CONSULTA_STATUS_LABEL: Record<ConsultaStatus, string> = {
  agendada: "Agendada",
  realizada: "Realizada",
  falta: "Faltou",
  cancelada: "Cancelada",
};

export const SYNC_STATUS = [
  "pendente",
  "sincronizada",
  "erro",
  "desativada",
] as const;
export type SyncStatus = (typeof SYNC_STATUS)[number];

export const SYNC_STATUS_LABEL: Record<SyncStatus, string> = {
  pendente: "Sincronização pendente",
  sincronizada: "Sincronizada com o Google",
  erro: "Erro na sincronização",
  desativada: "Sincronização desativada",
};

export type Consulta = {
  id: string;
  psicologa_id: string;
  paciente_id: string;
  inicio: string;
  fim: string;
  modalidade: Modalidade;
  status: ConsultaStatus;
  recorrencia: Recorrencia;
  serie_id: string | null;
  /** Marcada à mão pela psicóloga quando o paciente confirma; remarcar limpa. */
  confirmada_em: string | null;
  observacoes: string | null;
  google_event_id: string | null;
  meet_link: string | null;
  sync_status: SyncStatus;
  sync_erro: string | null;
  sync_em: string | null;
  /** Valor da sessão (migration 0035); null = sem cobrança. */
  valor: number | null;
  /** Na falta: cobrar a sessão mesmo assim? */
  cobrar: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Bloqueio = {
  id: string;
  psicologa_id: string;
  inicio: string;
  fim: string;
  motivo: string | null;
  // Migration 0036: dia inteiro (00:00 do primeiro dia até 00:00 do dia
  // seguinte ao último), série recorrente e evento no Google Agenda.
  dia_inteiro: boolean;
  recorrencia: Recorrencia;
  serie_id: string | null;
  google_event_id: string | null;
  sync_status: SyncStatus;
  sync_erro: string | null;
  sync_em: string | null;
  created_at: string;
  updated_at: string;
};
