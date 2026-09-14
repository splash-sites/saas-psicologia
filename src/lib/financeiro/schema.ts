import { z } from "zod";

const dataStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

export const pagamentoSchema = z.object({
  paciente_id: z.string().uuid("Selecione um paciente"),
  consulta_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  valor: z.coerce.number().positive("Informe um valor maior que zero"),
  data_referencia: dataStr,
  vencimento: dataStr,
  forma_pagamento: z
    .string()
    .trim()
    .max(60)
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
  observacoes: z
    .string()
    .trim()
    .max(2000)
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
});

export type PagamentoInput = z.infer<typeof pagamentoSchema>;

export const marcarPagoSchema = z.object({
  data_pagamento: dataStr,
  forma_pagamento: z
    .string()
    .trim()
    .max(60)
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
});
