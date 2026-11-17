import { describe, it, expect } from "vitest";
import {
  cobrancasComDesconto,
  descricaoDesconto,
  descontoDaLinha,
  menorCobrancaPossivel,
  mesesNaPrimeiraCobranca,
  primeiraCobranca,
  resumoComCupom,
  valorComDesconto,
  VALOR_MINIMO_COBRANCA,
} from "@/lib/assinatura/desconto";

const vinte3 = { tipo: "percentual" as const, valor: 20, meses: 3 };

describe("cupom de desconto: valor de cada cobrança", () => {
  it("mensal com 20%: R$ 39,92 nas 3 primeiras, depois o preço cheio", () => {
    expect(valorComDesconto("mensal", vinte3, 1)).toBe(39.92);
    expect(cobrancasComDesconto("mensal", vinte3)).toEqual([39.92, 39.92, 39.92]);
    expect(resumoComCupom("mensal", vinte3)).toBe("R$ 39,92 nas 3 primeiras cobranças, depois R$ 49,90");
  });

  it("trimestral: os 3 meses do cupom cabem na primeira cobrança", () => {
    // 134,73 − 3 × 20% × 44,91 = 107,78
    expect(primeiraCobranca("trimestral", vinte3)).toBe(107.78);
    expect(cobrancasComDesconto("trimestral", vinte3)).toEqual([107.78]);
    expect(resumoComCupom("trimestral", vinte3)).toBe("R$ 107,78 na primeira cobrança, depois R$ 134,73");
  });

  it("semestral: desconto em 3 dos 6 meses (conferido no sandbox)", () => {
    // 254,49 − 3 × 20% × 42,415 = 229,04
    expect(primeiraCobranca("semestral", vinte3)).toBe(229.04);
    expect(mesesNaPrimeiraCobranca("semestral", vinte3)).toBe(3);
  });

  it("cupom mais longo que o ciclo atravessa cobranças", () => {
    const cinco = { tipo: "percentual" as const, valor: 20, meses: 5 };
    // 3 meses na 1ª cobrança, 2 na 2ª
    expect(cobrancasComDesconto("trimestral", cinco)).toEqual([107.78, 116.77]);
    expect(resumoComCupom("trimestral", cinco)).toBe(
      "1ª cobrança R$ 107,78, 2ª cobrança R$ 116,77, depois R$ 134,73",
    );
  });

  it("R$ a menos por mês", () => {
    const dez = { tipo: "valor" as const, valor: 10, meses: 2 };
    expect(valorComDesconto("mensal", dez, 1)).toBe(39.9);
    expect(primeiraCobranca("semestral", dez)).toBe(234.49);
  });

  it("para sempre: o mesmo valor em toda cobrança", () => {
    const sempre = { tipo: "percentual" as const, valor: 10, meses: null };
    expect(primeiraCobranca("mensal", sempre)).toBe(44.91);
    expect(mesesNaPrimeiraCobranca("semestral", sempre)).toBe(6);
    expect(resumoComCupom("mensal", sempre)).toBe("R$ 44,91 por mês, sempre");
    expect(resumoComCupom("trimestral", sempre)).toBe("R$ 121,26 a cada 3 meses, sempre");
  });

  it("nunca abaixo do mínimo do Asaas", () => {
    expect(valorComDesconto("mensal", { tipo: "percentual", valor: 99 }, 1)).toBe(VALOR_MINIMO_COBRANCA);
    expect(valorComDesconto("mensal", { tipo: "valor", valor: 500 }, 1)).toBe(VALOR_MINIMO_COBRANCA);
    // sem piso, para o admin recusar o cupom
    expect(menorCobrancaPossivel({ tipo: "percentual", valor: 95, meses: 1 })).toBeLessThan(VALOR_MINIMO_COBRANCA);
    expect(menorCobrancaPossivel(vinte3)).toBe(39.92);
  });

  it("zero meses = preço cheio", () => {
    expect(valorComDesconto("semestral", vinte3, 0)).toBe(254.49);
  });
});

describe("cupom de desconto: textos e linha do banco", () => {
  it("descreve o desconto", () => {
    expect(descricaoDesconto(vinte3)).toBe("20% de desconto nos 3 primeiros meses");
    expect(descricaoDesconto({ tipo: "valor", valor: 10, meses: 1 })).toBe("R$ 10,00 a menos por mês no primeiro mês");
    expect(descricaoDesconto({ tipo: "percentual", valor: 12.5, meses: null })).toBe("12,5% de desconto, para sempre");
  });

  it("numeric do banco chega como texto", () => {
    expect(descontoDaLinha({ desconto_tipo: "percentual", desconto_valor: "20.00", meses_total: 3 })).toEqual(vinte3);
    expect(descontoDaLinha({ desconto_tipo: "valor", desconto_valor: 10, desconto_meses: null }).meses).toBeNull();
  });
});
