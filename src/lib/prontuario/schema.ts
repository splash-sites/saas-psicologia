import { z } from "zod";

const obrigatorio = (rotulo: string) =>
  z.string().trim().min(1, `${rotulo} é obrigatório`).max(20000);

// A estrutura mínima da CFP 01/2009 é exigência legal — os 4 campos não
// podem ficar vazios.
export const evolucaoSchema = z.object({
  data_sessao: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data da sessão inválida"),
  consulta_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  demanda: obrigatorio("Avaliação da demanda"),
  procedimentos: obrigatorio("Procedimentos"),
  resultados: obrigatorio("Resultados"),
  encaminhamentos: obrigatorio("Encaminhamentos"),
  notas_privadas: z
    .string()
    .trim()
    .max(20000)
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
});

export type EvolucaoInput = z.infer<typeof evolucaoSchema>;

export const arquivarSchema = z.object({
  motivo: z.string().trim().min(3, "Descreva o motivo do arquivamento").max(500),
});
