import { z } from "@/lib/zod";

// Usuários e indicadores do painel /admin (entrega 3, migration 0028). Os
// números vêm calculados do banco (admin_indicadores / admin_usuarios).

export const SITUACOES_CONTA = [
  "teste",
  "teste_encerrado",
  "aguardando",
  "pagando",
  "atrasada",
  "cancelada",
  "somente_leitura",
] as const;
export type SituacaoConta = (typeof SITUACOES_CONTA)[number];

export const SITUACAO_CONTA_LABEL: Record<SituacaoConta, string> = {
  teste: "Em teste",
  teste_encerrado: "Teste encerrado",
  aguardando: "Aguardando 1º pagamento",
  pagando: "Pagando",
  atrasada: "Atrasada",
  cancelada: "Cancelada (com acesso)",
  somente_leitura: "Somente leitura",
};

export const SITUACAO_CONTA_TOM: Record<SituacaoConta, string> = {
  teste: "bg-teal-50 text-teal-800",
  teste_encerrado: "bg-amber-100 text-amber-900",
  aguardando: "bg-amber-100 text-amber-900",
  pagando: "bg-teal-100 text-teal-800",
  atrasada: "bg-red-100 text-red-800",
  cancelada: "bg-slate-200 text-slate-700",
  somente_leitura: "bg-slate-200 text-slate-700",
};

export type UsuarioAdmin = {
  id: string;
  nome: string | null;
  email: string | null;
  cadastro: string;
  ultimo_login: string | null;
  situacao: SituacaoConta;
  plano: string;
  valor: number;
  trial_fim: string;
  proximo_vencimento: string | null;
  pagou: boolean;
  cupom: string | null;
  pacientes: number;
  consultas: number;
  evolucoes: number;
  ultima_atividade: string | null;
};

export type Indicadores = {
  total: number;
  por_situacao: Partial<Record<SituacaoConta, number>>;
  receita_mensal: number;
  ativas_30_dias: number;
  teste_acabou: number;
  converteram: number;
  cadastros_semana: { inicio: string; cadastros: number; com_cupom: number }[];
};

export const DIAS_ATIVA = 30;

/** "Usou nos últimos 30 dias": criou ou alterou algo (nunca lê conteúdo). */
export function usouRecentemente(ultimaAtividade: string | null, agora = new Date()): boolean {
  if (!ultimaAtividade) return false;
  return agora.getTime() - Date.parse(ultimaAtividade) <= DIAS_ATIVA * 86_400_000;
}

/** Pode estender o teste? Mesma regra do cupom: só quem não assinou. */
export function podeEstenderTeste(situacao: SituacaoConta): boolean {
  return situacao === "teste" || situacao === "teste_encerrado";
}

export function porcentagem(parte: number, todo: number): string {
  if (todo <= 0) return "—";
  return `${Math.round((parte / todo) * 100)}%`;
}

export const estenderTesteSchema = z.object({
  dias: z.coerce
    .number({ error: "Informe quantos dias" })
    .int("Use um número inteiro de dias")
    .min(1, "De 1 a 365 dias")
    .max(365, "De 1 a 365 dias"),
  motivo: z
    .string({ error: "Escreva o motivo" })
    .trim()
    .min(3, "Escreva o motivo (pelo menos 3 letras)")
    .max(300, "Máximo de 300 caracteres"),
});
