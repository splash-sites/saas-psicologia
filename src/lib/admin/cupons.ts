import { z } from "@/lib/zod";
import { FORMATO_CUPOM, normalizarCupom } from "@/lib/assinatura/cupom";

// Cupons no painel /admin (entrega 2). Mesmas regras dos CHECKs da tabela
// cupons (migration 0027): o Zod só dá a mensagem amigável antes.

export type CupomAdmin = {
  id: string;
  codigo: string;
  dias: number;
  valido_ate: string | null;
  limite_usos: number | null;
  ativo: boolean;
  created_at: string;
};

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

export const novoCupomSchema = z.object({
  codigo: z
    .string({ error: "Informe o código" })
    .transform(normalizarCupom)
    .pipe(
      z
        .string()
        .min(1, "Informe o código")
        .regex(FORMATO_CUPOM, "Use de 3 a 30 letras, números, hífen ou sublinhado, começando com letra ou número"),
    ),
  dias: z.coerce
    .number({ error: "Informe quantos dias grátis" })
    .int("Use um número inteiro de dias")
    .min(1, "De 1 a 365 dias")
    .max(365, "De 1 a 365 dias"),
  valido_ate: validade,
  limite_usos: limite,
});

export const edicaoCupomSchema = z.object({
  valido_ate: validade,
  limite_usos: limite,
});
