import { z } from "@/lib/zod";
import { LIMITES } from "@/lib/limites";

const MSG_TEXTO_LONGO = `Máximo de ${LIMITES.textoClinico} caracteres`;

const obrigatorio = (rotulo: string) =>
  z
    .string({ error: `${rotulo} é obrigatório` })
    .trim()
    .min(1, `${rotulo} é obrigatório`)
    .max(LIMITES.textoClinico, MSG_TEXTO_LONGO);

// Os 4 campos não podem ficar vazios por decisão de produto: dão estrutura à
// evolução do trabalho e aos procedimentos (Resolução CFP 01/2009, art. 2º,
// III). A resolução não pede "resultados" como item à parte.
export const evolucaoSchema = z.object({
  data_sessao: z
    .string({ error: "Informe a data da sessão" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data da sessão inválida"),
  consulta_id: z
    .string()
    .uuid("Consulta inválida")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  demanda: obrigatorio("Avaliação da demanda"),
  procedimentos: obrigatorio("Procedimentos"),
  resultados: obrigatorio("Resultados"),
  encaminhamentos: obrigatorio("Encaminhamentos"),
  notas_privadas: z
    .string()
    .trim()
    .max(LIMITES.textoClinico, MSG_TEXTO_LONGO)
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
});

export type EvolucaoInput = z.infer<typeof evolucaoSchema>;

export const arquivarSchema = z.object({
  motivo: z
    .string({ error: "Descreva o motivo do arquivamento" })
    .trim()
    .min(LIMITES.evolucao.motivoArquivamentoMin, "Descreva o motivo do arquivamento")
    .max(LIMITES.evolucao.motivoArquivamento, `Máximo de ${LIMITES.evolucao.motivoArquivamento} caracteres`),
});
