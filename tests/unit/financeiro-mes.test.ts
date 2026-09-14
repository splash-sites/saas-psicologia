import { describe, it, expect } from "vitest";
import {
  primeiroDia,
  ultimoDia,
  mesSeguinte,
  mesAnterior,
  ultimosMeses,
  rotuloMes,
} from "@/lib/financeiro/mes";
import { statusExibicao, formatarBRL } from "@/lib/financeiro/types";

describe("mes helpers", () => {
  it("primeiroDia e ultimoDia", () => {
    expect(primeiroDia("2026-02")).toBe("2026-02-01");
    expect(ultimoDia("2026-02")).toBe("2026-02-28"); // 2026 não é bissexto
    expect(ultimoDia("2028-02")).toBe("2028-02-29"); // bissexto
  });

  it("mesSeguinte e mesAnterior atravessam o ano", () => {
    expect(mesSeguinte("2026-12")).toBe("2027-01");
    expect(mesAnterior("2027-01")).toBe("2026-12");
  });

  it("ultimosMeses devolve N meses terminando no informado", () => {
    expect(ultimosMeses("2026-03", 4)).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
  });

  it("rotuloMes formata em português", () => {
    expect(rotuloMes("2026-01")).toMatch(/janeiro/i);
  });
});

describe("statusExibicao", () => {
  it("pago é sempre pago, mesmo com vencimento passado", () => {
    expect(
      statusExibicao({ status: "pago", vencimento: "2020-01-01" }, "2026-01-01"),
    ).toBe("pago");
  });

  it("pendente com vencimento futuro é pendente", () => {
    expect(
      statusExibicao({ status: "pendente", vencimento: "2026-02-01" }, "2026-01-01"),
    ).toBe("pendente");
  });

  it("pendente com vencimento passado é atrasado", () => {
    expect(
      statusExibicao({ status: "pendente", vencimento: "2025-12-01" }, "2026-01-01"),
    ).toBe("atrasado");
  });
});

describe("formatarBRL", () => {
  it("formata em reais", () => {
    expect(formatarBRL(150)).toContain("150,00");
    expect(formatarBRL(150)).toContain("R$");
  });
});
