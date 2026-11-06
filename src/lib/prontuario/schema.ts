import { z } from "zod";
import { LIMITES } from "@/lib/limites";

const obrigatorio = (rotulo: string) =>
  z.string().trim().min(1, `${rotulo} é obrigatório`).max(LIMITES.textoClinico);

// Os 4 campos não podem ficar vazios por decisão de produto: dão estrutura à
// evolução do trabalho e aos procedimentos (Resolução CFP 01/2009, art. 2º,
// III). A resolução não pede "resultados" como item à parte.
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
    .max(LIMITES.textoClinico)
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
});

export type EvolucaoInput = z.infer<typeof evolucaoSchema>;

export const arquivarSchema = z.object({
  motivo: z.string().trim().min(LIMITES.evolucao.motivoArquivamentoMin, "Descreva o motivo do arquivamento").max(LIMITES.evolucao.motivoArquivamento),
});
