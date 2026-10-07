import { z } from "zod";
import { CONSULTA_STATUS, MODALIDADES, RECORRENCIAS } from "./types";

const dataStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const horaStr = z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida");

export const consultaSchema = z
  .object({
    paciente_id: z.string().uuid("Selecione um paciente"),
    data: dataStr,
    hora: horaStr,
    duracao_min: z.coerce.number().int().min(15).max(480),
    modalidade: z.enum(MODALIDADES),
    recorrencia: z.enum(RECORRENCIAS).default("nenhuma"),
    ocorrencias: z.coerce.number().int().min(1).max(52).default(1),
    observacoes: z
      .string()
      .trim()
      .max(2000, "Máximo de 2000 caracteres")
      .transform((v) => (v === "" ? undefined : v))
      .optional(),
  })
  .refine((v) => v.recorrencia === "nenhuma" || v.ocorrencias >= 2, {
    message: "Informe ao menos 2 ocorrências para uma série",
    path: ["ocorrencias"],
  });

export type ConsultaInput = z.infer<typeof consultaSchema>;

// Edição de uma ocorrência isolada: sem recorrência, com status.
export const consultaEdicaoSchema = z.object({
  data: dataStr,
  hora: horaStr,
  duracao_min: z.coerce.number().int().min(15).max(480),
  modalidade: z.enum(MODALIDADES),
  status: z.enum(CONSULTA_STATUS),
  observacoes: z
    .string()
    .trim()
    .max(2000, "Máximo de 2000 caracteres")
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
});

export type ConsultaEdicaoInput = z.infer<typeof consultaEdicaoSchema>;

export const bloqueioSchema = z
  .object({
    data: dataStr,
    hora_inicio: horaStr,
    hora_fim: horaStr,
    motivo: z
      .string()
      .trim()
      .max(200, "Máximo de 200 caracteres")
      .transform((v) => (v === "" ? undefined : v))
      .optional(),
  })
  .refine((v) => v.hora_fim > v.hora_inicio, {
    message: "O fim deve ser depois do início",
    path: ["hora_fim"],
  });

export type BloqueioInput = z.infer<typeof bloqueioSchema>;
