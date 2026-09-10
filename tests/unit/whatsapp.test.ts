import { describe, it, expect } from "vitest";
import { whatsappLink } from "@/lib/pacientes/whatsapp";

describe("whatsappLink", () => {
  it("prefixa DDI 55 em número nacional com 11 dígitos", () => {
    expect(whatsappLink("(51) 99999-9999")).toBe("https://wa.me/5551999999999");
  });

  it("prefixa DDI 55 em número fixo com 10 dígitos", () => {
    expect(whatsappLink("51 3333-4444")).toBe("https://wa.me/555133334444");
  });

  it("mantém número que já vem com DDI", () => {
    expect(whatsappLink("55 51 99999-9999")).toBe("https://wa.me/5551999999999");
  });

  it("retorna null para vazio ou nulo", () => {
    expect(whatsappLink("")).toBeNull();
    expect(whatsappLink(null)).toBeNull();
    expect(whatsappLink(undefined)).toBeNull();
  });

  it("retorna null quando há dígitos de menos", () => {
    expect(whatsappLink("99999")).toBeNull();
  });

  it("retorna null quando há dígitos demais", () => {
    expect(whatsappLink("55519999999999999")).toBeNull();
  });
});
