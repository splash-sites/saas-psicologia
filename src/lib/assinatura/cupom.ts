// Cupom de dias grátis (migration 0027). O banco decide (aplicar_cupom /
// resgatar_cupom) e devolve um destes códigos; aqui só vira texto.

export const STATUS_CUPOM = [
  "ok",
  "invalido",
  "expirado",
  "esgotado",
  "ja_usou",
  "ja_assinou",
  "muitas_tentativas",
  "sem_sessao",
  // Cupom de desconto (migration 0031) digitado onde vale dias grátis.
  "cupom_de_desconto",
] as const;
export type StatusCupom = (typeof STATUS_CUPOM)[number];

/** Mesmo formato do CHECK de cupons.codigo, depois de normalizar. */
export const FORMATO_CUPOM = /^[A-Z0-9][A-Z0-9_-]{2,29}$/;

/** Como a psicóloga digitou → como está no banco ("psico30 " → "PSICO30"). */
export function normalizarCupom(codigo: string): string {
  return codigo.trim().toUpperCase();
}

function dataBR(iso: string): string {
  return iso.split("-").reverse().join("/");
}

/** Texto do resultado. `trialFim`: o novo fim do teste, quando deu certo. */
export function mensagemCupom(
  status: string,
  codigo: string,
  trialFim?: string | null,
): { tipo: "sucesso" | "erro"; texto: string } {
  switch (status as StatusCupom) {
    case "ok":
      return {
        tipo: "sucesso",
        texto: trialFim
          ? `Cupom ${codigo} aplicado: seu teste grátis vai até ${dataBR(trialFim)}.`
          : `Cupom ${codigo} aplicado.`,
      };
    case "expirado":
      return { tipo: "erro", texto: `O cupom ${codigo} venceu.` };
    case "esgotado":
      return { tipo: "erro", texto: `O cupom ${codigo} já atingiu o limite de usos.` };
    case "ja_usou":
      return { tipo: "erro", texto: "Sua conta já usou um cupom. Cada conta pode usar um só." };
    case "ja_assinou":
      return { tipo: "erro", texto: "Cupons de dias grátis valem só para quem ainda não assinou." };
    case "muitas_tentativas":
      return { tipo: "erro", texto: "Muitas tentativas com códigos errados. Tente de novo daqui a uma hora." };
    case "sem_sessao":
      return { tipo: "erro", texto: "Sua sessão terminou. Entre de novo e tente outra vez." };
    case "cupom_de_desconto":
      return {
        tipo: "sucesso",
        texto: `O cupom ${codigo} é de desconto na assinatura: ele entra quando você escolher o plano.`,
      };
    default:
      return { tipo: "erro", texto: `Não encontramos o cupom ${codigo}. Confira o código.` };
  }
}

/** Link da tela de Assinatura com o cupom de desconto já preenchido. */
export function linkAssinarComCupom(codigo: string): string {
  return `/assinatura?cupom=${encodeURIComponent(codigo)}#assinar`;
}

// Cupom de desconto (migration 0031): reservar_cupom_desconto /
// consultar_cupom_desconto devolvem um destes.
export const STATUS_CUPOM_DESCONTO = [
  "ok",
  "invalido",
  "expirado",
  "esgotado",
  "ja_usou",
  "ja_assinou",
  "cupom_de_dias",
  "em_andamento",
  "muitas_tentativas",
  "sem_sessao",
] as const;

/** Texto do erro do cupom de desconto (o "ok" a tela mostra com o desconto). */
export function mensagemCupomDesconto(status: string, codigo: string): string {
  switch (status) {
    case "expirado":
      return `O cupom ${codigo} venceu.`;
    case "esgotado":
      return `O cupom ${codigo} já atingiu o limite de usos.`;
    case "ja_usou":
      return "Sua conta já usou um cupom de desconto. Cada conta pode usar um só.";
    case "ja_assinou":
      return "Você já tem uma assinatura em andamento.";
    case "cupom_de_dias":
      return `O cupom ${codigo} dá dias grátis de teste, não desconto. Ele vale antes de assinar, em "Tenho um cupom".`;
    case "em_andamento":
      return "Sua assinatura está sendo preparada. Aguarde alguns instantes e atualize a página.";
    case "muitas_tentativas":
      return "Muitas tentativas com códigos errados. Tente de novo daqui a uma hora.";
    case "sem_sessao":
      return "Sua sessão terminou. Entre de novo e tente outra vez.";
    default:
      return `Não encontramos o cupom ${codigo}. Confira o código.`;
  }
}
