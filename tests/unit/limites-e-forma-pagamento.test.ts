import { describe, it, expect } from "vitest";
import { LIMITES } from "@/lib/limites";
import { pacienteSchema } from "@/lib/pacientes/schema";
import { evolucaoSchema } from "@/lib/prontuario/schema";
import { pagamentoSchema } from "@/lib/financeiro/schema";
import { FORMAS_PAGAMENTO, rotuloFormaPagamento } from "@/lib/financeiro/types";

describe("LIMITES no Zod", () => {
  it("nome do paciente: aceita o limite, recusa limite + 1", () => {
    const n = LIMITES.paciente.nome;
    expect(pacienteSchema.safeParse({ nome: "a".repeat(n) }).success).toBe(true);
    expect(pacienteSchema.safeParse({ nome: "a".repeat(n + 1) }).success).toBe(false);
  });

  it("campos da evolução seguem o limite de texto clínico", () => {
    const base = {
      data_sessao: "2026-03-09",
      demanda: "d",
      procedimentos: "p",
      resultados: "r",
      encaminhamentos: "e",
    };
    const n = LIMITES.textoClinico;
    expect(evolucaoSchema.safeParse({ ...base, demanda: "x".repeat(n) }).success).toBe(true);
    expect(evolucaoSchema.safeParse({ ...base, demanda: "x".repeat(n + 1) }).success).toBe(false);
  });
});

describe("forma de pagamento em lista fixa", () => {
  const base = {
    paciente_id: "6f1a2b3c-4d5e-4f60-8a71-2b3c4d5e6f70",
    valor: "100",
    data_referencia: "2026-03-01",
    situacao: "recebido",
    data_pagamento: "2026-03-02",
  };

  it("aceita os códigos da lista", () => {
    for (const forma of FORMAS_PAGAMENTO) {
      const r = pagamentoSchema.safeParse({ ...base, forma_pagamento: forma });
      expect(r.success, forma).toBe(true);
      if (r.success) expect(r.data.forma_pagamento).toBe(forma);
    }
  });

  it("vazio vira não informada", () => {
    const r = pagamentoSchema.safeParse({ ...base, forma_pagamento: "" });
    expect(r.success && r.data.forma_pagamento).toBeUndefined();
  });

  it("recusa texto livre fora da lista", () => {
    expect(pagamentoSchema.safeParse({ ...base, forma_pagamento: "Pix" }).success).toBe(false);
    expect(pagamentoSchema.safeParse({ ...base, forma_pagamento: "cheque" }).success).toBe(false);
  });

  it("rótulo para exibição; valor antigo desconhecido aparece como veio", () => {
    expect(rotuloFormaPagamento("cartao_credito")).toBe("Cartão de crédito");
    expect(rotuloFormaPagamento("cheque")).toBe("cheque");
    expect(rotuloFormaPagamento(null)).toBeNull();
  });
});
