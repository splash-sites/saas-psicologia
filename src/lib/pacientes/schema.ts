import { z } from "@/lib/zod";
import { DIA_COBRANCA_PADRAO, FORMAS_COBRANCA, PACIENTE_STATUS } from "./types";
import { capitalizarNome } from "./formatacao";
import { validarCpfCnpj } from "@/lib/assinatura/cpfCnpj";
import { LIMITES } from "@/lib/limites";

const L = LIMITES.paciente;

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

const telefoneOpcional = optionalText
  .transform((v) => (v === undefined ? undefined : telefoneNacional(v)))
  .pipe(z.string().regex(/^\d{10,11}$/, "Telefone inválido. Use DDD + número").optional());

const cpfOpcional = optionalText
  .transform((v) => (v === undefined ? undefined : soDigitos(v)))
  .pipe(z.string().refine((v) => validarCpfCnpj(v).tipo === "cpf", "CPF inválido").optional());

const nomeOpcional = optionalText
  .transform((v) => (v === undefined ? undefined : capitalizarNome(v)))
  .pipe(z.string().max(L.nome, `Máximo de ${L.nome} caracteres`).optional());

const relacaoOpcional = optionalText.pipe(z.string().max(L.relacao, `Máximo de ${L.relacao} caracteres`).optional());

// Checkbox de formulário: marcado envia "on", desmarcado não envia nada.
const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

const MSG_DIA = "Escolha um dia de 1 a 31";

export const pacienteSchema = z
  .object({
    nome: z
      .string({ error: "Nome é obrigatório" })
      .trim()
      .min(1, "Nome é obrigatório")
      .max(L.nome, `Máximo de ${L.nome} caracteres`)
      .transform(capitalizarNome),
    email: optionalText
      .transform((v) => v?.toLowerCase())
      .pipe(z.string().max(L.email, "E-mail longo demais").email("E-mail inválido").optional()),
    telefone: telefoneOpcional,
    data_nascimento: optionalText.pipe(
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
        .refine((v) => v >= "1900-01-01" && v <= hojeISO(), "Data de nascimento inválida")
        .optional(),
    ),
    cpf: cpfOpcional,
    endereco: optionalText.pipe(z.string().max(L.endereco, `Máximo de ${L.endereco} caracteres`).optional()),
    status: z.enum(PACIENTE_STATUS, { error: "Escolha um status da lista" }).default("ativo"),
    observacoes: optionalText.pipe(z.string().max(L.observacoes, `Máximo de ${L.observacoes} caracteres`).optional()),
    aceita_lembretes: checkbox,

    // Contato de emergência (migration 0034): nome e telefone juntos, relação opcional.
    emergencia_nome: nomeOpcional,
    emergencia_telefone: telefoneOpcional,
    emergencia_relacao: relacaoOpcional,

    // Responsável financeiro: só vale com "Quem paga as sessões é outra pessoa"
    // marcado; desmarcado, os campos são apagados.
    responsavel_outra_pessoa: checkbox,
    responsavel_nome: nomeOpcional,
    responsavel_cpf: cpfOpcional,
    responsavel_telefone: telefoneOpcional,
    responsavel_relacao: relacaoOpcional,

    // Vazio = atendimento social (nada vem preenchido na consulta).
    valor_sessao: optionalText
      .transform((v) => (v === undefined ? undefined : Number(v.replace(",", "."))))
      .pipe(
        z
          .number({ error: "Valor inválido" })
          .positive("Informe um valor maior que zero, ou deixe em branco")
          .max(L.valorSessaoMax, "Valor acima do limite (R$ 100.000)")
          .multipleOf(0.01, "Use no máximo 2 casas decimais")
          .optional(),
      ),
    cobranca: z.enum(FORMAS_COBRANCA, { error: "Escolha a forma de cobrança" }).default("sessao"),
    cobranca_dia: optionalText
      .transform((v) => (v === undefined ? DIA_COBRANCA_PADRAO : Number(v)))
      .pipe(z.number().int(MSG_DIA).min(1, MSG_DIA).max(31, MSG_DIA)),
  })
  .superRefine((v, ctx) => {
    if (v.emergencia_nome && !v.emergencia_telefone) {
      ctx.addIssue({ code: "custom", path: ["emergencia_telefone"], message: "Informe o telefone do contato de emergência" });
    }
    if (!v.emergencia_nome && (v.emergencia_telefone || v.emergencia_relacao)) {
      ctx.addIssue({ code: "custom", path: ["emergencia_nome"], message: "Informe o nome do contato de emergência" });
    }
    if (v.responsavel_outra_pessoa && !v.responsavel_nome) {
      ctx.addIssue({ code: "custom", path: ["responsavel_nome"], message: "Informe o nome de quem paga" });
    }
  })
  .transform(({ responsavel_outra_pessoa, ...v }) =>
    responsavel_outra_pessoa
      ? v
      : {
          ...v,
          responsavel_nome: undefined,
          responsavel_cpf: undefined,
          responsavel_telefone: undefined,
          responsavel_relacao: undefined,
        },
  );

export type PacienteInput = z.infer<typeof pacienteSchema>;

const textoLongo = optionalText.pipe(z.string().max(LIMITES.textoClinico, `Máximo de ${LIMITES.textoClinico} caracteres`).optional());

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
