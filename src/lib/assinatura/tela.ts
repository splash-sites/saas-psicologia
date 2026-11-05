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

/** Dias do teste já usados (0 a 14), para a barra de progresso. */
export function diasUsadosDoTeste(trialFim: string, hojeISO?: string): number {
  const restantes = diasRestantesTrial(trialFim, hojeISO);
  return Math.min(DIAS_TRIAL, Math.max(0, DIAS_TRIAL - restantes));
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

