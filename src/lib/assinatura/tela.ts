import {
  diasRestantesTrial,
  DIAS_TRIAL,
  formatarCpfCnpj,
  trialEncerrado,
  type Assinatura,
} from "./types";

/**
 * O que a tela de Assinatura mostra. "teste" e "encerrado" = ainda não
 * assinou (formulário de planos); "aguardando" = assinou e falta o primeiro
 * pagamento; "cancelada" e "leitura" = mostra o status e o formulário de novo,
 * para assinar outra vez.
 */
export type EstadoTela =
  | "teste"
  | "encerrado"
  | "aguardando"
  | "ativa"
  | "atrasada"
  | "cancelada"
  | "leitura";

export function estadoDaTela(
  a: Pick<Assinatura, "status" | "trial_fim" | "asaas_subscription_id">,
  somenteLeitura: boolean,
  hojeISO: string = new Date().toISOString().slice(0, 10),
): EstadoTela {
  if (a.status === "cancelada") return somenteLeitura ? "leitura" : "cancelada";
  if (a.status === "ativa") return "ativa";
  if (a.status === "atrasada") return "atrasada";
  if (a.asaas_subscription_id) return "aguardando";
  return trialEncerrado(a, hojeISO) ? "encerrado" : "teste";
}

/** O formulário de planos aparece antes de assinar e para assinar de novo. */
export function mostraFormulario(estado: EstadoTela): boolean {
  return estado === "teste" || estado === "encerrado" || estado === "cancelada" || estado === "leitura";
}

/**
 * Quantos dias de teste a conta ganhou: do cadastro até trial_fim. O teste
 * já foi de 14 dias e agora é de 7 (0021); quem se cadastrou antes mantém
 * os 14, então a tela não pode usar um número fixo. Fora do esperado, cai
 * no padrão atual.
 */
export function duracaoDoTeste(
  a: Pick<Assinatura, "trial_fim" | "created_at">,
  resgate?: ResgateCupom | null,
): number {
  const dias = diasRestantesTrial(a.trial_fim, inicioDoTeste(a, resgate));
  return dias >= 1 && dias <= 400 ? dias : DIAS_TRIAL;
}

/** Cupom usado pela conta (cupom_resgates, migration 0027). */
export type ResgateCupom = { codigo: string; created_at: string; trial_fim_antes: string; trial_fim_depois: string };

/**
 * Onde o período de teste atual começa: no cadastro, ou no dia em que um
 * cupom foi usado com o teste já vencido (aí os dias contam a partir dele).
 */
export function inicioDoTeste(
  a: Pick<Assinatura, "created_at">,
  resgate?: ResgateCupom | null,
): string {
  const cadastro = a.created_at.slice(0, 10);
  if (!resgate) return cadastro;
  const usoDoCupom = resgate.created_at.slice(0, 10);
  return resgate.trial_fim_antes < usoDoCupom ? usoDoCupom : cadastro;
}

/** Dias que o cupom deu (fim depois − fim antes, ou a partir do uso). */
export function diasDoCupom(resgate: ResgateCupom): number {
  const base = resgate.trial_fim_antes < resgate.created_at.slice(0, 10) ? resgate.created_at.slice(0, 10) : resgate.trial_fim_antes;
  return diasRestantesTrial(resgate.trial_fim_depois, base);
}

/** Dias do teste já usados (0 até a duração), para a barra de progresso. */
export function diasUsadosDoTeste(trialFim: string, total: number, hojeISO?: string): number {
  const restantes = diasRestantesTrial(trialFim, hojeISO);
  return Math.min(total, Math.max(0, total - restantes));
}

/** "Hoje", "Amanhã", "Daqui a 5 dias", "Ontem", "Há 4 dias". */
export function distanciaEmDias(dataISO: string, hojeISO?: string): string {
  const d = diasRestantesTrial(dataISO, hojeISO);
  if (d === 0) return "Hoje";
  if (d === 1) return "Amanhã";
  if (d === -1) return "Ontem";
  return d > 0 ? `Daqui a ${d} dias` : `Há ${-d} dias`;
}

/** CPF/CNPJ com o começo e o fim escondidos: •••.456.789-•• */
export function documentoMascarado(digitos: string): string {
  const formatado = formatarCpfCnpj(digitos);
  let vistos = 0;
  const total = digitos.length;
  return formatado.replace(/\d/g, (c) => {
    vistos++;
    return vistos <= 3 || vistos > total - 2 ? "•" : c;
  });
}

