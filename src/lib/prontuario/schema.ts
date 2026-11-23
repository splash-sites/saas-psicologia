import { z } from "@/lib/zod";
import { LIMITES } from "@/lib/limites";

const MSG_TEXTO_LONGO = `Máximo de ${LIMITES.textoClinico} caracteres`;

// Texto opcional: vazio vira undefined (o banco guarda NULL).
const opcional = () =>
  z
    .string()
    .trim()
    .max(LIMITES.textoClinico, MSG_TEXTO_LONGO)
    .transform((v) => (v === "" ? undefined : v))
    .optional();

export const MSG_EVOLUCAO_VAZIA = "Preencha pelo menos um campo da evolução (pode ser só as notas privadas).";

// Os 4 campos dão estrutura à evolução do trabalho (Resolução CFP 01/2009,
// art. 2º, III — os campos em si são decisão de produto), mas nenhum é
// obrigatório: basta um preenchido, e as notas privadas contam (decisão do
// usuário, 2026-11-23; mesma regra na CHECK evolucoes_algum_campo, 0033).
export const evolucaoSchema = z
  .object({
    data_sessao: z
      .string({ error: "Informe a data da sessão" })
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data da sessão inválida"),
    consulta_id: z
      .string()
      .uuid("Consulta inválida")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    demanda: opcional(),
    procedimentos: opcional(),
    resultados: opcional(),
    encaminhamentos: opcional(),
    notas_privadas: opcional(),
  })
  .refine(
    (v) => Boolean(v.demanda || v.procedimentos || v.resultados || v.encaminhamentos || v.notas_privadas),
    { message: MSG_EVOLUCAO_VAZIA, path: ["demanda"] },
  );

export type EvolucaoInput = z.infer<typeof evolucaoSchema>;

export const arquivarSchema = z.object({
  motivo: z
    .string({ error: "Descreva o motivo do arquivamento" })
    .trim()
    .min(LIMITES.evolucao.motivoArquivamentoMin, "Descreva o motivo do arquivamento")
    .max(LIMITES.evolucao.motivoArquivamento, `Máximo de ${LIMITES.evolucao.motivoArquivamento} caracteres`),
});
