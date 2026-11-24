import { z } from "@/lib/zod";
import { LIMITES } from "@/lib/limites";
import { MIMES_DOCUMENTO, TIPOS_DOCUMENTO } from "./tipos";

const L = LIMITES.documento;

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .optional()
    .transform((v) => (v ? v : null));

/** Dados do documento (anexar e editar). */
export const documentoDadosSchema = z.object({
  nome: z.string({ error: "Informe o nome" }).trim().min(1, "Informe o nome").max(L.nome, `Máximo de ${L.nome} caracteres`),
  tipo: z.enum(Object.keys(TIPOS_DOCUMENTO) as [keyof typeof TIPOS_DOCUMENTO], { error: "Escolha o tipo" }),
  data_documento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  finalidade: opcional(L.finalidade),
  destinatario: opcional(L.destinatario),
});

/** Início do envio: dados + o arquivo que o navegador vai mandar. */
export const iniciarEnvioSchema = documentoDadosSchema.extend({
  evolucao_id: z.string().uuid().optional().nullable(),
  mime: z.enum(MIMES_DOCUMENTO, { error: "Tipo de arquivo não aceito. Use PDF, Word (.docx), JPG ou PNG." }),
  tamanho: z.coerce
    .number()
    .int()
    .positive("Arquivo vazio")
    .max(L.tamanhoMax, "O arquivo passa de 10 MB."),
});

export type IniciarEnvioInput = z.input<typeof iniciarEnvioSchema>;
