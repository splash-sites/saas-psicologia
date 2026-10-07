import { z } from "zod";
import { PACIENTE_STATUS } from "./types";
import { capitalizarNome } from "./formatacao";
import { validarCpfCnpj } from "@/lib/assinatura/cpfCnpj";

// Normaliza strings de formulário: "" (campo vazio) vira undefined.
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

// Mesmo formato que o banco grava (migration 0013): só dígitos, sem DDI 55.
// A máscara é só de exibição.
function soDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

function telefoneNacional(v: string): string {
  const d = soDigitos(v);
  return /^55\d{10,11}$/.test(d) ? d.slice(2) : d;
}

function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export const pacienteSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(200, "Máximo de 200 caracteres").transform(capitalizarNome),
  email: optionalText
    .transform((v) => v?.toLowerCase())
    .pipe(z.string().max(254, "E-mail longo demais").email("E-mail inválido").optional()),
  telefone: optionalText
    .transform((v) => (v === undefined ? undefined : telefoneNacional(v)))
    .pipe(z.string().regex(/^\d{10,11}$/, "Telefone inválido — use DDD + número").optional()),
  data_nascimento: optionalText.pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
      .refine((v) => v >= "1900-01-01" && v <= hojeISO(), "Data de nascimento inválida")
      .optional(),
  ),
  cpf: optionalText
    .transform((v) => (v === undefined ? undefined : soDigitos(v)))
    .pipe(
      z
        .string()
        .refine((v) => validarCpfCnpj(v).tipo === "cpf", "CPF inválido")
        .optional(),
    ),
  endereco: optionalText.pipe(z.string().max(300, "Máximo de 300 caracteres").optional()),
  status: z.enum(PACIENTE_STATUS).default("ativo"),
  observacoes: optionalText.pipe(z.string().max(5000, "Máximo de 5000 caracteres").optional()),
  // Checkbox de formulário: marcado envia "on", desmarcado não envia nada.
  aceita_lembretes: z.preprocess(
    (v) => v === "on" || v === "true" || v === true,
    z.boolean(),
  ),
});

export type PacienteInput = z.infer<typeof pacienteSchema>;

const textoLongo = optionalText.pipe(z.string().max(20000, "Máximo de 20000 caracteres").optional());

export const anamneseSchema = z.object({
  demanda: textoLongo,
  objetivos: textoLongo,
  historico: textoLongo,
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
