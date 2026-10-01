import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  asaasModo,
  asaasConfigurada,
  criarClienteAsaas,
  criarAssinaturaAsaas,
  cancelarAssinaturaAsaas,
  primeiraCobrancaDaAssinatura,
  buscarCobranca,
} from "@/lib/asaas/client";

const originais = { modo: process.env.ASAAS_MODE, chave: process.env.ASAAS_API_KEY };

beforeEach(() => {
  delete process.env.ASAAS_MODE;
  delete process.env.ASAAS_API_KEY;
});

afterEach(() => {
  if (originais.modo === undefined) delete process.env.ASAAS_MODE;
  else process.env.ASAAS_MODE = originais.modo;
  if (originais.chave === undefined) delete process.env.ASAAS_API_KEY;
  else process.env.ASAAS_API_KEY = originais.chave;
});

describe("asaasModo / asaasConfigurada", () => {
  it("sem chave e sem modo explícito, é simulado", () => {
    expect(asaasModo()).toBe("mock");
    expect(asaasConfigurada()).toBe(false);
  });

  it("com chave e sem ASAAS_MODE, assume sandbox", () => {
    process.env.ASAAS_API_KEY = "chave-teste";
    expect(asaasModo()).toBe("sandbox");
    expect(asaasConfigurada()).toBe(true);
  });

  it("ASAAS_MODE=production respeita o valor mesmo com chave presente", () => {
    process.env.ASAAS_API_KEY = "chave-teste";
    process.env.ASAAS_MODE = "production";
    expect(asaasModo()).toBe("production");
  });

  it("ASAAS_MODE=mock força simulado mesmo com chave presente", () => {
    process.env.ASAAS_API_KEY = "chave-teste";
    process.env.ASAAS_MODE = "mock";
    expect(asaasModo()).toBe("mock");
  });
});

describe("modo simulado — nenhuma chamada de rede", () => {
  it("criarClienteAsaas devolve um id fabricado", async () => {
    const r = await criarClienteAsaas({ nome: "Teste", email: "t@t.com", cpfCnpj: "11144477735" });
    expect(r.id).toMatch(/^mock_cus_/);
  });

  it("criarAssinaturaAsaas devolve um id fabricado", async () => {
    const r = await criarAssinaturaAsaas({
      customerId: "mock_cus_x",
      valor: 49.9,
      primeiroVencimento: "2026-04-01",
      ciclo: "MONTHLY",
    });
    expect(r.id).toMatch(/^mock_sub_/);
  });

  it("cancelarAssinaturaAsaas não lança mesmo sem assinatura real", async () => {
    await expect(cancelarAssinaturaAsaas("mock_sub_x")).resolves.toBeUndefined();
  });

  it("primeiraCobrancaDaAssinatura e buscarCobranca devolvem null", async () => {
    expect(await primeiraCobrancaDaAssinatura("mock_sub_x")).toBeNull();
    expect(await buscarCobranca("mock_pay_x")).toBeNull();
  });
});
