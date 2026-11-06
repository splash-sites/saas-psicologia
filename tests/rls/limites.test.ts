import { describe, it, expect } from "vitest";
import { LIMITES } from "@/lib/limites";
import { hasLocalSupabase, userClient, signUpPsicologa } from "./_helpers";

// O banco tem os mesmos limites de src/lib/limites.ts (CHECKs das migrations
// 0007/0013) e as regras da 0024/0025. Se alguém mudar um número só no código,
// este teste quebra.
describe.skipIf(!hasLocalSupabase)("Banco: limites e regras iguais aos do código", () => {
  async function setup() {
    const s = Date.now() + Math.random();
    const a = await signUpPsicologa(`lim-${s}@teste.local`);
    const c = userClient(a.accessToken);
    const { data } = await c
      .from("pacientes")
      .insert({ psicologa_id: a.id, nome: "Paciente" })
      .select("id")
      .single();
    return { a, c, paciente: data!.id as string };
  }

  it("paciente: aceita o limite, recusa limite + 1", async () => {
    const { a, c } = await setup();
    const L = LIMITES.paciente;
    for (const [campo, n] of [
      ["nome", L.nome],
      ["endereco", L.endereco],
      ["observacoes", L.observacoes],
    ] as const) {
      const ok = await c.from("pacientes").insert({ psicologa_id: a.id, nome: "P", [campo]: "a".repeat(n) });
      expect(ok.error, `${campo} = ${n}`).toBeNull();
      const ruim = await c.from("pacientes").insert({ psicologa_id: a.id, nome: "P", [campo]: "a".repeat(n + 1) });
      expect(ruim.error, `${campo} = ${n + 1}`).not.toBeNull();
    }
  });

  it("evolução e pagamento seguem os mesmos limites", async () => {
    const { a, c, paciente } = await setup();
    const evo = (demanda: string) => ({
      psicologa_id: a.id,
      paciente_id: paciente,
      data_sessao: "2026-03-09",
      demanda,
      procedimentos: "p",
      resultados: "r",
      encaminhamentos: "e",
    });
    expect((await c.from("evolucoes").insert(evo("x".repeat(LIMITES.textoClinico)))).error).toBeNull();
    expect((await c.from("evolucoes").insert(evo("x".repeat(LIMITES.textoClinico + 1)))).error).not.toBeNull();

    const pag = { psicologa_id: a.id, paciente_id: paciente, data_referencia: "2026-03-09", vencimento: "2026-03-09" };
    expect((await c.from("pagamentos").insert({ ...pag, valor: LIMITES.pagamento.valorMax })).error).toBeNull();
    expect((await c.from("pagamentos").insert({ ...pag, valor: LIMITES.pagamento.valorMax + 1 })).error).not.toBeNull();
  });

  it("CPF com dígito inválido e nascimento no futuro são recusados (0025)", async () => {
    const { a, c } = await setup();
    const base = { psicologa_id: a.id, nome: "P" };
    expect((await c.from("pacientes").insert({ ...base, cpf: "52998224725" })).error).toBeNull();
    expect((await c.from("pacientes").insert({ ...base, cpf: "52998224724" })).error).not.toBeNull();
    expect((await c.from("pacientes").insert({ ...base, cpf: "11111111111" })).error).not.toBeNull();
    const amanha = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    expect((await c.from("pacientes").insert({ ...base, data_nascimento: amanha })).error).not.toBeNull();
  });

  it("converte textos antigos de forma de pagamento para a lista (0024)", async () => {
    const { c } = await setup();
    const casos: Record<string, string | null> = {
      "PIX ": "pix",
      "Cartão de Crédito": "cartao_credito",
      "débito": "cartao_debito",
      "Dinheiro em espécie": "dinheiro",
      TED: "transferencia",
      Boleto: "boleto",
      cheque: "outro",
      "": null,
    };
    for (const [texto, esperado] of Object.entries(casos)) {
      const { data, error } = await c.rpc("forma_pagamento_codigo", { t: texto });
      expect(error).toBeNull();
      expect(data, texto).toBe(esperado);
    }
  });
});
