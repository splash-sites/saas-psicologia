import { z } from "@/lib/zod";
import { CONSULTA_STATUS, MODALIDADES, RECORRENCIAS } from "./types";
import { LIMITES } from "@/lib/limites";
import { valorOpcional } from "@/lib/dinheiro";
import { addDias } from "./datas";
import { MAX_DIAS_BLOQUEIO } from "./bloqueios";

const C = LIMITES.consulta;
const MSG_DURACAO = `A duração vai de ${C.duracaoMin} a ${C.duracaoMax} minutos`;
const MSG_VALOR = "Informe um valor maior que zero, ou deixe em branco (sem cobrança)";
const MSG_OCORRENCIAS =`Escolha de 2 a ${C.ocorrenciasMax} ocorrências`;

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
    // Vem do valor da sessão do paciente; vazio = sem cobrança.
    valor: valorOpcional(MSG_VALOR),
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
  valor: valorOpcional(MSG_VALOR),
  // Só vale na falta ("Cobrar esta falta"); desmarcado não envia nada.
  cobrar: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  status: z.enum(CONSULTA_STATUS, { error: "Escolha um status da lista" }),
  observacoes: z
    .string()
    .trim()
    .max(C.observacoes, `Máximo de ${C.observacoes} caracteres`)
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
});

export type ConsultaEdicaoInput = z.infer<typeof consultaEdicaoSchema>;

const vazioIndefinido = (v: unknown) => (v === "" || v === null ? undefined : v);
const marcado = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

/**
 * Bloqueio (entrega D, migration 0036): horário de um dia, dia inteiro (um ou
 * vários dias seguidos) ou recorrente até uma data (no máximo 1 ano). Motivo
 * obrigatório.
 */
export const bloqueioSchema = z
  .object({
    dia_inteiro: marcado,
    data: dataStr,
    data_fim: z.preprocess(vazioIndefinido, dataStr.optional()),
    hora_inicio: z.preprocess(vazioIndefinido, horaStr.optional()),
    hora_fim: z.preprocess(vazioIndefinido, horaStr.optional()),
    motivo: z
      .string({ error: "Informe o motivo do bloqueio" })
      .trim()
      .min(1, "Informe o motivo do bloqueio")
      .max(LIMITES.bloqueio.motivo, `Máximo de ${LIMITES.bloqueio.motivo} caracteres`),
    recorrencia: z.enum(RECORRENCIAS, { error: "Escolha uma recorrência da lista" }).default("nenhuma"),
    repetir_ate: z.preprocess(vazioIndefinido, dataStr.optional()),
    // Segunda chamada, depois de ver a lista: cancelar as consultas do período.
    cancelar_consultas: marcado,
  })
  .superRefine((v, ctx) => {
    const limite = addDias(v.data, MAX_DIAS_BLOQUEIO);
    if (!v.dia_inteiro) {
      if (!v.hora_inicio) ctx.addIssue({ code: "custom", path: ["hora_inicio"], message: "Informe o horário" });
      if (!v.hora_fim) ctx.addIssue({ code: "custom", path: ["hora_fim"], message: "Informe o horário" });
      if (v.hora_inicio && v.hora_fim && v.hora_fim <= v.hora_inicio) {
        ctx.addIssue({ code: "custom", path: ["hora_fim"], message: "O fim deve ser depois do início" });
      }
    }
    if (v.dia_inteiro && v.recorrencia === "nenhuma" && v.data_fim) {
      if (v.data_fim < v.data) {
        ctx.addIssue({ code: "custom", path: ["data_fim"], message: "O último dia deve ser depois do primeiro" });
      } else if (v.data_fim > limite) {
        ctx.addIssue({ code: "custom", path: ["data_fim"], message: "No máximo 1 ano num bloqueio só" });
      }
    }
    if (v.recorrencia !== "nenhuma") {
      if (!v.repetir_ate) {
        ctx.addIssue({ code: "custom", path: ["repetir_ate"], message: "Até quando repete?" });
      } else if (v.repetir_ate < v.data) {
        ctx.addIssue({ code: "custom", path: ["repetir_ate"], message: "Deve ser depois do primeiro dia" });
      } else if (v.repetir_ate > limite) {
        ctx.addIssue({ code: "custom", path: ["repetir_ate"], message: "No máximo 1 ano à frente" });
      }
    }
  });

export type BloqueioInput = z.infer<typeof bloqueioSchema>;
