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
  /** Valor da sessão (0035); null = sem cobrança. */
  valor: number | null;
  cobrar: boolean;
  estado: EstadoVisual;
  evolucaoId?: string;
  evolucaoPendente: boolean;
  pagamentoPendente: boolean;
  /** Tem "Anotações para a sessão" (0043). */
  temAnotacoes?: boolean;
};

export type ItemBloqueio = {
  id: string;
  inicio: string;
  fim: string;
  motivo: string | null;
  dia_inteiro?: boolean;
};

/** Estado da tela da agenda que vive na URL. */
export type ParamsAgenda = {
  semana: string;
  dia?: string;
  consulta?: string;
  ocultarCanceladas?: boolean;
  /** Abre o painel já escrevendo as anotações para a sessão. */
  anotar?: boolean;
};

export function agendaHref(p: ParamsAgenda): string {
  const q = new URLSearchParams({ semana: p.semana });
  if (p.dia) q.set("dia", p.dia);
  if (p.ocultarCanceladas) q.set("canceladas", "0");
  if (p.consulta) q.set("consulta", p.consulta);
  if (p.consulta && p.anotar) q.set("anotar", "1");
  return `/agenda?${q.toString()}`;
}

/** Aniversariante do dia na agenda (item H). */
export type ItemAniversario = { id: string; nome: string; idade: number };
