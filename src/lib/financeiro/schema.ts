import { z } from "zod";

const dataStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

const dataOpcional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional()
  .pipe(dataStr.optional());

// O formulário tem dois caminhos: "recebido" (já pago — informa data do
// pagamento) e "a_receber" (informa vencimento). Tudo é preenchido uma vez só;
// o status e as datas derivadas são calculados aqui.
export const pagamentoSchema = z
  .object({
    paciente_id: z.string().uuid("Selecione um paciente"),
    consulta_id: z
      .string()
      .uuid()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    valor: z.coerce.number().positive("Informe um valor maior que zero"),
    situacao: z.enum(["recebido", "a_receber"]).default("recebido"),
    data_referencia: dataStr,
    data_pagamento: dataOpcional,
    vencimento: dataOpcional,
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
  })
  .superRefine((v, ctx) => {
    if (v.situacao === "recebido" && !v.data_pagamento) {
      ctx.addIssue({
        code: "custom",
        path: ["data_pagamento"],
        message: "Informe a data do pagamento",
      });
    }
    if (v.situacao === "a_receber" && !v.vencimento) {
      ctx.addIssue({
        code: "custom",
        path: ["vencimento"],
        message: "Informe o vencimento",
      });
    }
  })
  .transform((v) => ({
    paciente_id: v.paciente_id,
    consulta_id: v.consulta_id,
    valor: v.valor,
    data_referencia: v.data_referencia,
    forma_pagamento: v.forma_pagamento,
    observacoes: v.observacoes,
    status: (v.situacao === "recebido" ? "pago" : "pendente") as
      | "pago"
      | "pendente",
    data_pagamento: v.situacao === "recebido" ? v.data_pagamento! : null,
    // Já recebido não tem cobrança em aberto: vencimento = referência.
    vencimento:
      v.situacao === "recebido" ? v.data_referencia : v.vencimento!,
  }));

export type PagamentoInput = z.output<typeof pagamentoSchema>;

export const marcarPagoSchema = z.object({
  data_pagamento: dataStr,
  forma_pagamento: z
    .string()
    .trim()
    .max(60)
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
});
