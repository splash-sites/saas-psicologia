import { describe, it, expect } from "vitest";
import { diaMes, diasEntre, idade, situacaoLancamento, tomDoAtraso } from "@/lib/financeiro/situacao";

const HOJE = "2026-11-25";
const pend = (vencimento: string) => ({ status: "pendente" as const, vencimento, data_pagamento: null });

describe("situacaoLancamento", () => {
  it("pago: 'Pago em dd/mm' (com o ano se for de outro ano)", () => {
    expect(situacaoLancamento({ status: "pago", vencimento: "2026-11-03", data_pagamento: "2026-11-20" }, HOJE)).toMatchObject({
      tipo: "pago",
      texto: "Pago em 20/11",
      tom: "pago",
    });
    expect(situacaoLancamento({ status: "pago", vencimento: "2025-12-03", data_pagamento: "2025-12-10" }, HOJE).texto).toBe("Pago em 10/12/25");
  });

  it("atrasado conta do vencimento, com a cor pela idade", () => {
    expect(situacaoLancamento(pend("2026-11-03"), HOJE)).toMatchObject({ tipo: "atrasado", texto: "Atrasado há 22 dias", tom: "recente", dias: 22 });
    expect(situacaoLancamento(pend("2026-11-24"), HOJE).texto).toBe("Atrasado há 1 dia");
    expect(situacaoLancamento(pend("2026-09-26"), HOJE).tom).toBe("medio"); // 60 dias
    expect(situacaoLancamento(pend("2021-02-03"), HOJE)).toMatchObject({ texto: "Atrasado há 5 anos", tom: "antigo" });
  });

  it("cobrança mensal ainda no prazo: 'A vencer em', sem cor de atraso; no dia: 'Vence hoje'", () => {
    expect(situacaoLancamento(pend("2026-12-10"), HOJE)).toMatchObject({ tipo: "a_vencer", texto: "A vencer em 10/12", tom: "neutro" });
    expect(situacaoLancamento(pend(HOJE), HOJE)).toMatchObject({ tipo: "vence_hoje", tom: "neutro" });
  });
});

describe("auxiliares", () => {
  it("faixas de cor: até 30, 31–90, mais de 90", () => {
    expect([30, 31, 90, 91].map(tomDoAtraso)).toEqual(["recente", "medio", "medio", "antigo"]);
  });
  it("idade em dias, meses e anos", () => {
    expect([1, 22, 59, 60, 364, 365, 800].map(idade)).toEqual(["1 dia", "22 dias", "59 dias", "2 meses", "12 meses", "1 ano", "2 anos"]);
  });
  it("dias entre datas atravessa mês e ano", () => {
    expect(diasEntre("2026-12-31", "2027-01-01")).toBe(1);
    expect(diaMes("2026-01-05", HOJE)).toBe("05/01");
  });
});
