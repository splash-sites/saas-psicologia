import { z } from "@/lib/zod";
import { FORMATO_CUPOM, normalizarCupom } from "@/lib/assinatura/cupom";
import { PLANOS } from "@/lib/assinatura/types";
import {
  cobrancaMinima,
  descontoDaLinha,
  descricaoDesconto,
  VALOR_MINIMO_COBRANCA,
} from "@/lib/assinatura/desconto";

// Cupons no painel /admin. Mesmas regras dos CHECKs da tabela cupons
// (migrations 0027 e 0031): o Zod só dá a mensagem amigável antes. A regra do
// mínimo de R$ 5 por cobrança só existe aqui (depende dos preços dos planos).

export type CupomAdmin = {
  id: string;
  codigo: string;
  tipo: "dias" | "desconto";
  dias: number | null;
  desconto_tipo: "percentual" | "valor" | null;
  desconto_valor: number | string | null;
  /** null = para sempre (só cupom de desconto). */
  desconto_meses: number | null;
  valido_ate: string | null;
  limite_usos: number | null;
  ativo: boolean;
  created_at: string;
};

/** Onde ficam os usos de cada tipo de cupom. */
export function tabelaDeUsos(tipo: CupomAdmin["tipo"]): "cupom_resgates" | "cupom_descontos" {
  return tipo === "desconto" ? "cupom_descontos" : "cupom_resgates";
}

/** "30 dias grátis" ou "20% de desconto nos 3 primeiros meses". */
export function beneficioDoCupom(c: Pick<CupomAdmin, "tipo" | "dias" | "desconto_tipo" | "desconto_valor" | "desconto_meses">): string {
  if (c.tipo === "desconto" && c.desconto_tipo) {
    return descricaoDesconto(
      descontoDaLinha({
        desconto_tipo: c.desconto_tipo,
        desconto_valor: c.desconto_valor ?? 0,
        desconto_meses: c.desconto_meses,
      }),
    );
  }
  return `${c.dias} dias grátis`;
}

export type SituacaoCupom = "ativo" | "pausado" | "vencido" | "esgotado";

export const SITUACAO_CUPOM_LABEL: Record<SituacaoCupom, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  vencido: "Vencido",
  esgotado: "Esgotado",
};

export const TOM_SITUACAO: Record<SituacaoCupom, string> = {
  ativo: "bg-teal-100 text-teal-800",
  pausado: "bg-slate-200 text-slate-700",
  vencido: "bg-amber-100 text-amber-900",
  esgotado: "bg-amber-100 text-amber-900",
};

/** O que acontece se alguém tentar usar o cupom hoje. */
export function situacaoCupom(
  c: Pick<CupomAdmin, "ativo" | "valido_ate" | "limite_usos">,
  usos: number,
  hojeISO: string,
): SituacaoCupom {
  if (!c.ativo) return "pausado";
  if (c.valido_ate && c.valido_ate < hojeISO) return "vencido";
  if (c.limite_usos !== null && usos >= c.limite_usos) return "esgotado";
  return "ativo";
}

const vazioParaUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const validade = z.preprocess(
  vazioParaUndefined,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").optional(),
);

const limite = z.preprocess(
  vazioParaUndefined,
  z.coerce
    .number({ error: "Informe um número de usos" })
    .int("Use um número inteiro")
    .min(1, "O limite é de pelo menos 1 uso")
    .max(100_000, "Limite alto demais")
    .optional(),
);

const codigo = z
  .string({ error: "Informe o código" })
  .transform(normalizarCupom)
  .pipe(
    z
      .string()
      .min(1, "Informe o código")
      .regex(FORMATO_CUPOM, "Use de 3 a 30 letras, números, hífen ou sublinhado, começando com letra ou número"),
  );

const cupomDias = z.object({
  tipo: z.literal("dias"),
  codigo,
  dias: z.coerce
    .number({ error: "Informe quantos dias grátis" })
    .int("Use um número inteiro de dias")
    .min(1, "De 1 a 365 dias")
    .max(365, "De 1 a 365 dias"),
  valido_ate: validade,
  limite_usos: limite,
});

/** Aceita vírgula decimal ("12,5"). */
const decimal = (v: unknown) => (typeof v === "string" ? v.trim().replace(",", ".") : v);

const cupomDesconto = z
  .object({
    tipo: z.literal("desconto"),
    codigo,
    desconto_tipo: z.enum(["percentual", "valor"], { error: "Escolha % ou R$" }),
    desconto_valor: z.preprocess(
      decimal,
      z.coerce
        .number({ error: "Informe o desconto" })
        .positive("O desconto precisa ser maior que zero")
        .multipleOf(0.01, "Use no máximo 2 casas decimais"),
    ),
    desconto_duracao: z.enum(["meses", "sempre"], { error: "Escolha por quantos meses" }),
    desconto_meses: z.preprocess(
      vazioParaUndefined,
      z.coerce
        .number({ error: "Informe quantos meses" })
        .int("Use um número inteiro de meses")
        .min(1, "De 1 a 120 meses")
        .max(120, "De 1 a 120 meses")
        .optional(),
    ),
    valido_ate: validade,
    limite_usos: limite,
  });

/** Novo cupom: dias grátis (o padrão, se não vier o tipo) ou desconto. */
export const novoCupomSchema = z
  .preprocess(
    (v) => (v && typeof v === "object" && !("tipo" in v) ? { ...v, tipo: "dias" } : v),
    z.discriminatedUnion("tipo", [cupomDias, cupomDesconto]),
  )
  .superRefine((v, ctx) => {
    if (v.tipo !== "desconto") return;
    if (v.desconto_duracao === "meses" && v.desconto_meses === undefined) {
      ctx.addIssue({ code: "custom", path: ["desconto_meses"], message: "Informe quantos meses" });
      return;
    }
    if (v.desconto_tipo === "percentual" && v.desconto_valor >= 100) {
      ctx.addIssue({ code: "custom", path: ["desconto_valor"], message: "Menos de 100% (o Asaas não cobra R$ 0)" });
      return;
    }
    const minima = cobrancaMinima({
      tipo: v.desconto_tipo,
      valor: v.desconto_valor,
      meses: v.desconto_duracao === "sempre" ? null : (v.desconto_meses ?? null),
    });
    if (minima.valor < VALOR_MINIMO_COBRANCA) {
      ctx.addIssue({
        code: "custom",
        path: ["desconto_valor"],
        message: `No plano ${PLANOS[minima.plano].label.toLowerCase()}, a cobrança ficaria em R$ ${minima.valor
          .toFixed(2)
          .replace(".", ",")}: o Asaas não cobra menos de R$ 5,00. Diminua o desconto.`,
      });
    }
  })
  .transform((v) => {
    if (v.tipo !== "desconto") return v;
    const { desconto_duracao, desconto_meses, ...resto } = v;
    return { ...resto, desconto_meses: desconto_duracao === "sempre" ? null : (desconto_meses ?? null) };
  });

export type NovoCupom = z.output<typeof novoCupomSchema>;

export const edicaoCupomSchema = z.object({
  valido_ate: validade,
  limite_usos: limite,
});
