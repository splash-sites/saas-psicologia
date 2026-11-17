// Cupom de desconto na assinatura (migration 0031). O banco guarda o cupom e
// conta os meses usados; aqui fica a conta do valor de cada cobrança, que o
// servidor manda para o Asaas.
//
// O desconto é por mês: valor do mês = preço do plano ÷ meses do plano (já com
// o desconto do trimestral/semestral), e vale nos meses do cupom que caem
// dentro da cobrança. Ex.: semestral R$ 254,49 com 20% nos 3 primeiros meses
// = 254,49 − 3 × 20% × 42,415 = R$ 229,04.

import { ASSINATURA_PLANO, PLANOS, type AssinaturaPlano } from "./types";

/** O Asaas recusa cobrança abaixo disso (testado no sandbox em 2026-11-17). */
export const VALOR_MINIMO_COBRANCA = 5;

export const TIPOS_DESCONTO = ["percentual", "valor"] as const;
export type TipoDesconto = (typeof TIPOS_DESCONTO)[number];

export type Desconto = {
  tipo: TipoDesconto;
  /** % (0–100) ou R$ a menos por mês. */
  valor: number;
  /** Quantos meses com desconto; null = para sempre. */
  meses: number | null;
};

const centavos = (reais: number) => Math.round(reais * 100);

/** Em centavos, sem o piso do Asaas. */
function centavosComDesconto(
  plano: AssinaturaPlano,
  desconto: Pick<Desconto, "tipo" | "valor">,
  mesesComDesconto: number,
): number {
  const p = PLANOS[plano];
  const k = Math.max(0, Math.min(p.meses, Math.floor(mesesComDesconto)));
  const total = centavos(p.valor);
  const porMes = total / p.meses;
  const descontoPorMes =
    desconto.tipo === "percentual"
      ? (porMes * Math.min(100, Math.max(0, desconto.valor))) / 100
      : Math.min(porMes, centavos(Math.max(0, desconto.valor)));
  return total - Math.round(descontoPorMes * k);
}

/**
 * Valor da cobrança de um plano com `mesesComDesconto` meses descontados
 * (0 até a duração do plano). Nunca abaixo do mínimo do Asaas.
 */
export function valorComDesconto(
  plano: AssinaturaPlano,
  desconto: Pick<Desconto, "tipo" | "valor">,
  mesesComDesconto: number,
): number {
  return Math.max(centavosComDesconto(plano, desconto, mesesComDesconto), centavos(VALOR_MINIMO_COBRANCA)) / 100;
}

/** Meses com desconto na primeira cobrança do plano. */
export function mesesNaPrimeiraCobranca(plano: AssinaturaPlano, desconto: Pick<Desconto, "meses">): number {
  const meses = PLANOS[plano].meses;
  return desconto.meses === null ? meses : Math.min(meses, desconto.meses);
}

/** Valor da primeira cobrança de cada plano com o cupom. */
export function primeiraCobranca(plano: AssinaturaPlano, desconto: Desconto): number {
  return valorComDesconto(plano, desconto, mesesNaPrimeiraCobranca(plano, desconto));
}

/**
 * A menor cobrança que o cupom pode gerar em qualquer plano. Abaixo do mínimo
 * do Asaas, o cupom não pode ser criado (o valor seria arredondado para cima e
 * a psicóloga pagaria mais do que o cupom promete).
 */
export function menorCobrancaPossivel(desconto: Desconto): number {
  return cobrancaMinima(desconto).valor;
}

/** Igual a menorCobrancaPossivel, dizendo em qual plano (para a mensagem do admin). */
export function cobrancaMinima(desconto: Desconto): { plano: AssinaturaPlano; valor: number } {
  return ASSINATURA_PLANO.map((plano) => ({
    plano,
    valor: centavosComDesconto(plano, desconto, mesesNaPrimeiraCobranca(plano, desconto)) / 100,
  })).reduce((menor, atual) => (atual.valor < menor.valor ? atual : menor));
}

/** Valores das cobranças com desconto, em ordem (cupom por N meses). */
export function cobrancasComDesconto(plano: AssinaturaPlano, desconto: Desconto): number[] {
  if (desconto.meses === null) return [primeiraCobranca(plano, desconto)];
  const porCobranca = PLANOS[plano].meses;
  const valores: number[] = [];
  for (let resta = desconto.meses; resta > 0; resta -= porCobranca) {
    valores.push(valorComDesconto(plano, desconto, Math.min(porCobranca, resta)));
  }
  return valores;
}

/**
 * O que a psicóloga vai pagar com o cupom, em uma frase:
 * "R$ 39,92 nas 3 primeiras cobranças, depois R$ 49,90".
 */
export function resumoComCupom(plano: AssinaturaPlano, desconto: Desconto): string {
  const p = PLANOS[plano];
  if (desconto.meses === null) {
    const v = brl(primeiraCobranca(plano, desconto));
    return p.meses === 1 ? `${v} por mês, sempre` : `${v} a cada ${p.meses} meses, sempre`;
  }
  const valores = cobrancasComDesconto(plano, desconto);
  const depois = `depois ${brl(p.valor)}`;
  if (valores.every((v) => v === valores[0])) {
    return valores.length === 1
      ? `${brl(valores[0])} na primeira cobrança, ${depois}`
      : `${brl(valores[0])} nas ${valores.length} primeiras cobranças, ${depois}`;
  }
  return `${valores.map((v, i) => `${i + 1}ª cobrança ${brl(v)}`).join(", ")}, ${depois}`;
}

function brl(valor: number): string {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

/** "20% nos 3 primeiros meses", "R$ 10,00 a menos por mês, para sempre". */
export function descricaoDesconto(d: Desconto): string {
  const quanto = d.tipo === "percentual" ? `${String(d.valor).replace(".", ",")}% de desconto` : `${brl(d.valor)} a menos por mês`;
  if (d.meses === null) return `${quanto}, para sempre`;
  if (d.meses === 1) return `${quanto} no primeiro mês`;
  return `${quanto} nos ${d.meses} primeiros meses`;
}

/** Linha do banco (cupom_descontos ou a prévia do cupom) → Desconto. */
export function descontoDaLinha(linha: {
  desconto_tipo: string;
  desconto_valor: number | string;
  meses_total?: number | null;
  desconto_meses?: number | null;
}): Desconto {
  return {
    tipo: linha.desconto_tipo === "valor" ? "valor" : "percentual",
    valor: Number(linha.desconto_valor),
    meses: linha.meses_total ?? linha.desconto_meses ?? null,
  };
}
