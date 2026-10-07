import { describe, it, expect } from "vitest";
import {
  tokenValido,
  chaveIdempotencia,
  classificarEvento,
  statusIndicaPago,
  proximoMesDe,
  verificarCobranca,
} from "@/lib/asaas/webhook";

describe("verificarCobranca", () => {
  const cobranca = { status: "RECEIVED", subscription: "sub_1" };

  it("usa o status da API, não o do corpo", () => {
    expect(verificarCobranca("sandbox", "PENDING", cobranca, "sub_1")).toEqual({
      tipo: "ok",
      status: "RECEIVED",
    });
    expect(
      verificarCobranca("production", "RECEIVED", { status: "PENDING", subscription: "sub_1" }, "sub_1"),
    ).toEqual({ tipo: "ok", status: "PENDING" });
  });

  it("API fora do ar nunca cai no status do corpo", () => {
    expect(verificarCobranca("sandbox", "RECEIVED", null, "sub_1")).toEqual({ tipo: "indisponivel" });
  });

  it("cobrança de outra assinatura é divergente", () => {
    expect(verificarCobranca("sandbox", "RECEIVED", cobranca, "sub_outra")).toEqual({ tipo: "divergente" });
    expect(
      verificarCobranca("sandbox", "RECEIVED", { status: "RECEIVED", subscription: null }, "sub_1"),
    ).toEqual({ tipo: "divergente" });
  });

  it("modo simulado confia no corpo (não há API pra consultar)", () => {
    expect(verificarCobranca("mock", "RECEIVED", null, "sub_1")).toEqual({ tipo: "ok", status: "RECEIVED" });
  });
});

describe("tokenValido", () => {
  it("aceita quando os tokens batem", () => {
    expect(tokenValido("segredo-123", "segredo-123")).toBe(true);
  });

  it("rejeita token diferente, ausente ou faltando o esperado", () => {
    expect(tokenValido("errado", "segredo-123")).toBe(false);
    expect(tokenValido(null, "segredo-123")).toBe(false);
    expect(tokenValido("segredo-123", undefined)).toBe(false);
    expect(tokenValido("segredo-1234", "segredo-123")).toBe(false); // tamanho diferente
  });
});

describe("chaveIdempotencia", () => {
  it("combina evento, id do pagamento e status", () => {
    expect(chaveIdempotencia("PAYMENT_RECEIVED", "pay_1", "RECEIVED")).toBe(
      "PAYMENT_RECEIVED:pay_1:RECEIVED",
    );
  });

  it("status ausente vira string vazia, não 'undefined'", () => {
    expect(chaveIdempotencia("PAYMENT_CREATED", "pay_1", undefined)).toBe(
      "PAYMENT_CREATED:pay_1:",
    );
  });
});

describe("classificarEvento", () => {
  it("reconhece os eventos de confirmação de pagamento", () => {
    for (const e of ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_RECEIVED_IN_CASH"]) {
      expect(classificarEvento(e)).toBe("confirma_pagamento");
    }
  });

  it("reconhece atraso", () => {
    expect(classificarEvento("PAYMENT_OVERDUE")).toBe("atraso");
  });

  it("ignora eventos desconhecidos", () => {
    expect(classificarEvento("PAYMENT_CREATED")).toBe("ignorar");
    expect(classificarEvento("QUALQUER_COISA")).toBe("ignorar");
  });
});

describe("statusIndicaPago", () => {
  it("reconhece os status pagos do Asaas", () => {
    expect(statusIndicaPago("CONFIRMED")).toBe(true);
    expect(statusIndicaPago("RECEIVED")).toBe(true);
    expect(statusIndicaPago("RECEIVED_IN_CASH")).toBe(true);
  });

  it("não confunde pendente/vencido/nulo com pago", () => {
    expect(statusIndicaPago("PENDING")).toBe(false);
    expect(statusIndicaPago("OVERDUE")).toBe(false);
    expect(statusIndicaPago(null)).toBe(false);
    expect(statusIndicaPago(undefined)).toBe(false);
  });
});

describe("proximoMesDe", () => {
  it("soma um mês", () => {
    expect(proximoMesDe("2026-03-10")).toBe("2026-04-10");
  });

  it("atravessa o ano", () => {
    expect(proximoMesDe("2026-12-15")).toBe("2027-01-15");
  });
});
