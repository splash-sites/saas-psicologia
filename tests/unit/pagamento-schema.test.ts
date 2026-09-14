import { describe, it, expect } from "vitest";
import { pagamentoSchema } from "@/lib/financeiro/schema";

const valido = {
  paciente_id: "6f1a2b3c-4d5e-4f60-8a71-2b3c4d5e6f70",
  valor: "150.5",
  data_referencia: "2026-03-01",
  vencimento: "2026-03-10",
};

describe("pagamentoSchema", () => {
  it("aceita lançamento válido e converte valor pra número", () => {
    const r = pagamentoSchema.safeParse(valido);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.valor).toBe(150.5);
  });

  it("rejeita valor zero ou negativo", () => {
    expect(pagamentoSchema.safeParse({ ...valido, valor: "0" }).success).toBe(false);
    expect(pagamentoSchema.safeParse({ ...valido, valor: "-10" }).success).toBe(
      false,
    );
  });

  it("rejeita paciente_id que não é uuid", () => {
    expect(
      pagamentoSchema.safeParse({ ...valido, paciente_id: "abc" }).success,
    ).toBe(false);
  });

  it("consulta_id vazio vira undefined", () => {
    const r = pagamentoSchema.safeParse({ ...valido, consulta_id: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.consulta_id).toBeUndefined();
  });
});
