import { describe, it, expect } from "vitest";
import { FORMATO_CUPOM, mensagemCupom, normalizarCupom, STATUS_CUPOM } from "@/lib/assinatura/cupom";
import { diasDoCupom, duracaoDoTeste, inicioDoTeste } from "@/lib/assinatura/tela";

describe("cupom: código e mensagens", () => {
  it("normaliza e confere o formato como o banco", () => {
    expect(normalizarCupom("  psico30 ")).toBe("PSICO30");
    expect(FORMATO_CUPOM.test("PSICO30")).toBe(true);
    expect(FORMATO_CUPOM.test("CONGRESSO-2026")).toBe(true);
    expect(FORMATO_CUPOM.test("AB")).toBe(false);
    expect(FORMATO_CUPOM.test("COM ESPACO")).toBe(false);
    expect(FORMATO_CUPOM.test("-COMECA")).toBe(false);
  });

  it("todo status tem mensagem em português; sucesso mostra o novo fim", () => {
    expect(mensagemCupom("ok", "PSICO30", "2026-12-18")).toEqual({
      tipo: "sucesso",
      texto: "Cupom PSICO30 aplicado: seu teste grátis vai até 18/12/2026.",
    });
    for (const s of STATUS_CUPOM.filter((s) => s !== "ok")) {
      const m = mensagemCupom(s, "PSICO30");
      expect(m.tipo).toBe("erro");
      expect(m.texto.length).toBeGreaterThan(10);
    }
    expect(mensagemCupom("qualquer-coisa", "X1Y").texto).toBe("Não encontramos o cupom X1Y. Confira o código.");
  });
});

describe("cupom: período do teste", () => {
  const conta = { created_at: "2026-11-01T12:00:00Z", trial_fim: "2026-12-08" };

  it("cupom com o teste correndo: período desde o cadastro (7 + 30 = 37)", () => {
    const resgate = { codigo: "PSICO30", created_at: "2026-11-03T10:00:00Z", trial_fim_antes: "2026-11-08", trial_fim_depois: "2026-12-08" };
    expect(inicioDoTeste(conta, resgate)).toBe("2026-11-01");
    expect(duracaoDoTeste(conta, resgate)).toBe(37);
    expect(diasDoCupom(resgate)).toBe(30);
  });

  it("cupom com o teste vencido: período começa no dia do uso", () => {
    const antiga = { created_at: "2026-09-01T12:00:00Z", trial_fim: "2026-12-11" };
    const resgate = { codigo: "VOLTA30", created_at: "2026-11-11T09:00:00Z", trial_fim_antes: "2026-09-08", trial_fim_depois: "2026-12-11" };
    expect(inicioDoTeste(antiga, resgate)).toBe("2026-11-11");
    expect(duracaoDoTeste(antiga, resgate)).toBe(30);
    expect(diasDoCupom(resgate)).toBe(30);
  });
});
