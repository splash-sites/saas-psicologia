import { z } from "@/lib/zod";

/** Máximo de um valor em reais (sessão, consulta, lançamento) — igual aos CHECKs do banco. */
export const VALOR_MAXIMO = 100000;

/**
 * Valor em reais opcional vindo de formulário: vazio vira undefined, aceita
 * vírgula decimal, maior que zero, no máximo 2 casas.
 */
export function valorOpcional(vazio = "Informe um valor maior que zero, ou deixe em branco") {
  return z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : Number(v.replace(",", "."))))
    .pipe(
      z
        .number({ error: "Valor inválido" })
        .positive(vazio)
        .max(VALOR_MAXIMO, "Valor acima do limite (R$ 100.000)")
        .multipleOf(0.01, "Use no máximo 2 casas decimais")
        .optional(),
    )
    .optional();
}
