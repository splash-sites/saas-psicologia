import { z } from "@/lib/zod";
import { CONSULTA_STATUS, MODALIDADES, RECORRENCIAS } from "./types";
import { LIMITES } from "@/lib/limites";

const C = LIMITES.consulta;
const MSG_DURACAO = `A duração vai de ${C.duracaoMin} a ${C.duracaoMax} minutos`;
const MSG_OCORRENCIAS = `Escolha de 2 a ${C.ocorrenciasMax} ocorrências`;

const duracao = z.coerce
  .number({ error: "Informe a duração em minutos" })
  .int("Use minutos inteiros")
  .min(C.duracaoMin, MSG_DURACAO)
  .max(C.duracaoMax, MSG_DURACAO);
const modalidade = z.enum(MODALIDADES, { error: "Escolha presencial ou online" });

const dataStr = z.string({ error: "Informe a data" }).regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const horaStr = z.string({ error: "Informe o horário" }).regex(/^\d{2}:\d{2}$/, "Hora inválida");

export const consultaSchema = z
  .object({
    paciente_id: z.string({ error: "Selecione um paciente" }).uuid("Selecione um paciente"),
    data: dataStr,
    hora: horaStr,
    duracao_min: duracao,
    modalidade,
    recorrencia: z.enum(RECORRENCIAS, { error: "Escolha uma recorrência da lista" }).default("nenhuma"),
    ocorrencias: z.coerce
      .number({ error: "Informe o número de ocorrências" })
      .int("Use um número inteiro")
      .min(1, MSG_OCORRENCIAS)
      .max(C.ocorrenciasMax, MSG_OCORRENCIAS)
      .default(1),
    observacoes: z
      .string()
      .trim()
      .max(C.observacoes, `Máximo de ${C.observacoes} caracteres`)
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
  duracao_min: duracao,
  modalidade,
  status: z.enum(CONSULTA_STATUS, { error: "Escolha um status da lista" }),
  observacoes: z
    .string()
    .trim()
    .max(C.observacoes, `Máximo de ${C.observacoes} caracteres`)
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
      .max(LIMITES.bloqueio.motivo, `Máximo de ${LIMITES.bloqueio.motivo} caracteres`)
      .transform((v) => (v === "" ? undefined : v))
      .optional(),
  })
  .refine((v) => v.hora_fim > v.hora_inicio, {
    message: "O fim deve ser depois do início",
    path: ["hora_fim"],
  });

export type BloqueioInput = z.infer<typeof bloqueioSchema>;
