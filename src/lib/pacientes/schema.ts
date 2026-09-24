import { z } from "zod";
import { PACIENTE_STATUS } from "./types";

// Normaliza strings de formulário: "" (campo vazio) vira undefined.
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

export const pacienteSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(200),
  email: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .optional()
    .pipe(z.string().email("E-mail inválido").optional()),
  telefone: optionalText.pipe(z.string().max(20).optional()),
  data_nascimento: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .optional()
    .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").optional()),
  cpf: optionalText.pipe(z.string().max(14).optional()),
  endereco: optionalText,
  status: z.enum(PACIENTE_STATUS).default("ativo"),
  observacoes: optionalText,
  // Checkbox de formulário: marcado envia "on", desmarcado não envia nada.
  aceita_lembretes: z.preprocess(
    (v) => v === "on" || v === "true" || v === true,
    z.boolean(),
  ),
});

export type PacienteInput = z.infer<typeof pacienteSchema>;

export const anamneseSchema = z.object({
  demanda: optionalText,
  objetivos: optionalText,
  historico: optionalText,
});

export type AnamneseInput = z.infer<typeof anamneseSchema>;

/** Converte o resultado do zod em colunas do banco (undefined vira null). */
export function toNullable<T extends Record<string, unknown>>(
  obj: T,
): { [K in keyof T]: T[K] extends undefined ? null : NonNullable<T[K]> | null } {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v === undefined ? null : v;
  }
  return out as never;
}
