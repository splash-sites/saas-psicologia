import { describe, it, expect } from "vitest";
import { pagamentoSchema } from "@/lib/financeiro/schema";

const base = {
  paciente_id: "6f1a2b3c-4d5e-4f60-8a71-2b3c4d5e6f70",
  valor: "150.5",
  data_referencia: "2026-03-01",
};

describe("pagamentoSchema — já recebido", () => {
  const recebido = { ...base, situacao: "recebido", data_pagamento: "2026-03-02" };

  it("vira status pago, com data do pagamento e vencimento = referência", () => {
    const r = pagamentoSchema.safeParse(recebido);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.status).toBe("pago");
      expect(r.data.data_pagamento).toBe("2026-03-02");
      expect(r.data.vencimento).toBe("2026-03-01");
      expect(r.data.valor).toBe(150.5);
    }
  });

  it("exige a data do pagamento", () => {
    const r = pagamentoSchema.safeParse({ ...base, situacao: "recebido" });
    expect(r.success).toBe(false);
  });

  it("assume 'recebido' quando a situação não é informada", () => {
    const r = pagamentoSchema.safeParse({ ...base, data_pagamento: "2026-03-02" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe("pago");
  });
});

describe("pagamentoSchema — a receber", () => {
  const aReceber = { ...base, situacao: "a_receber", vencimento: "2026-03-10" };

  it("vira status pendente, sem data de pagamento", () => {
    const r = pagamentoSchema.safeParse(aReceber);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.status).toBe("pendente");
      expect(r.data.data_pagamento).toBeNull();
      expect(r.data.vencimento).toBe("2026-03-10");
    }
  });

  it("exige o vencimento", () => {
    const r = pagamentoSchema.safeParse({ ...base, situacao: "a_receber" });
    expect(r.success).toBe(false);
  });

  it("campo de data vazio é tratado como ausente", () => {
    const r = pagamentoSchema.safeParse({
      ...aReceber,
      data_pagamento: "",
    });
    expect(r.success).toBe(true);
  });
});

describe("pagamentoSchema — validações gerais", () => {
  const ok = { ...base, situacao: "recebido", data_pagamento: "2026-03-02" };

  it("rejeita valor zero ou negativo", () => {
    expect(pagamentoSchema.safeParse({ ...ok, valor: "0" }).success).toBe(false);
    expect(pagamentoSchema.safeParse({ ...ok, valor: "-10" }).success).toBe(false);
  });

  it("rejeita paciente_id que não é uuid", () => {
    expect(pagamentoSchema.safeParse({ ...ok, paciente_id: "abc" }).success).toBe(
      false,
    );
  });

  it("consulta_id vazio vira undefined", () => {
    const r = pagamentoSchema.safeParse({ ...ok, consulta_id: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.consulta_id).toBeUndefined();
  });

  it("rejeita situação desconhecida", () => {
    expect(pagamentoSchema.safeParse({ ...ok, situacao: "talvez" }).success).toBe(
      false,
    );
  });
});
