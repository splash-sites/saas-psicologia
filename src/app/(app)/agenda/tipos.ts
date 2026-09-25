import type { EstadoVisual } from "@/lib/agenda/grade";
import type {
  ConsultaStatus,
  Modalidade,
  Recorrencia,
} from "@/lib/agenda/types";

export type ItemConsulta = {
  id: string;
  inicio: string;
  fim: string;
  modalidade: Modalidade;
  status: ConsultaStatus;
  recorrencia: Recorrencia;
  serie_id: string | null;
  confirmada_em: string | null;
  meet_link: string | null;
  paciente: { id: string; nome: string } | null;
  estado: EstadoVisual;
  evolucaoId?: string;
  evolucaoPendente: boolean;
  pagamentoPendente: boolean;
};

export type ItemBloqueio = {
  id: string;
  inicio: string;
  fim: string;
  motivo: string | null;
};

/** Estado da tela da agenda que vive na URL. */
export type ParamsAgenda = {
  semana: string;
  dia?: string;
  consulta?: string;
  ocultarCanceladas?: boolean;
};

export function agendaHref(p: ParamsAgenda): string {
  const q = new URLSearchParams({ semana: p.semana });
  if (p.dia) q.set("dia", p.dia);
  if (p.ocultarCanceladas) q.set("canceladas", "0");
  if (p.consulta) q.set("consulta", p.consulta);
  return `/agenda?${q.toString()}`;
}
