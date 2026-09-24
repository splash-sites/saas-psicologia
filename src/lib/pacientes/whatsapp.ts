/**
 * Monta um link wa.me a partir de um telefone em formato livre.
 * Assume Brasil (DDI 55) quando o número não traz DDI.
 * Retorna null se não sobrar dígito suficiente para um número válido.
 * Item 7 do MVP: abre o WhatsApp Web, sem mensagem pré-preenchida.
 */
export function whatsappLink(telefone: string | null | undefined): string | null {
  if (!telefone) return null;

  let digits = telefone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return null;

  // 10 ou 11 dígitos = número nacional (DDD + assinante) sem DDI: prefixa 55.
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }

  return `https://wa.me/${digits}`;
}

/** Link wa.me com a mensagem já preenchida (a psicóloga só clica em enviar). */
export function whatsappLinkComTexto(
  telefone: string | null | undefined,
  texto: string,
): string | null {
  const base = whatsappLink(telefone);
  if (!base) return null;
  return `${base}?text=${encodeURIComponent(texto)}`;
}
