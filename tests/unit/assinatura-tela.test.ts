import { describe, it, expect } from "vitest";
import {
  diasUsadosDoTeste,
  distanciaEmDias,
  documentoMascarado,
  estadoDaTela,
  mostraFormulario,
} from "@/lib/assinatura/tela";

const HOJE = "2026-11-05";
const base = { trial_fim: "2026-11-10", asaas_subscription_id: null as string | null };

describe("estadoDaTela", () => {
  it("antes de assinar: teste ou teste encerrado", () => {
    expect(estadoDaTela({ ...base, status: "trial" }, false, HOJE)).toBe("teste");
    expect(estadoDaTela({ ...base, status: "trial", trial_fim: "2026-11-01" }, true, HOJE)).toBe("encerrado");
  });

  it("assinou e falta pagar: aguardando, mesmo com o teste no fim", () => {
    expect(estadoDaTela({ ...base, status: "trial", asaas_subscription_id: "sub_1" }, false, HOJE)).toBe("aguardando");
    expect(
      estadoDaTela({ status: "trial", trial_fim: "2026-11-01", asaas_subscription_id: "sub_1" }, true, HOJE),
    ).toBe("aguardando");
  });

  it("ativa, atrasada, cancelada e somente leitura", () => {
    const sub = { ...base, asaas_subscription_id: "sub_1" };
    expect(estadoDaTela({ ...sub, status: "ativa" }, false, HOJE)).toBe("ativa");
    expect(estadoDaTela({ ...sub, status: "atrasada" }, true, HOJE)).toBe("atrasada");
    expect(estadoDaTela({ ...sub, status: "cancelada" }, false, HOJE)).toBe("cancelada");
    expect(estadoDaTela({ ...sub, status: "cancelada" }, true, HOJE)).toBe("leitura");
  });

  it("o formulário aparece antes de assinar e para assinar de novo", () => {
    expect(["teste", "encerrado", "cancelada", "leitura"].every((e) => mostraFormulario(e as never))).toBe(true);
    expect(["aguardando", "ativa", "atrasada"].some((e) => mostraFormulario(e as never))).toBe(false);
  });
});

describe("apoio da tela", () => {
  it("dias usados do teste, de 0 a 14", () => {
    expect(diasUsadosDoTeste("2026-11-10", HOJE)).toBe(9);
    expect(diasUsadosDoTeste("2026-11-01", HOJE)).toBe(14);
    expect(diasUsadosDoTeste("2026-11-25", HOJE)).toBe(0);
  });

  it("distância em dias", () => {
    expect(distanciaEmDias("2026-11-05", HOJE)).toBe("Hoje");
    expect(distanciaEmDias("2026-11-06", HOJE)).toBe("Amanhã");
    expect(distanciaEmDias("2026-11-20", HOJE)).toBe("Daqui a 15 dias");
    expect(distanciaEmDias("2026-11-01", HOJE)).toBe("Há 4 dias");
  });

  it("documento com começo e fim escondidos", () => {
    expect(documentoMascarado("52998224725")).toBe("•••.982.247-••");
    expect(documentoMascarado("11222333000181")).toBe("••.•22.333/0001-••");
  });
});
