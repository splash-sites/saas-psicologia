import { describe, it, expect } from "vitest";
import {
  adminClient,
  anonClient,
  hasAdmin,
  hasLocalSupabase,
  signUpPsicologa,
  userClient,
} from "./_helpers";

// Migration 0027: cupons de dias grátis.
const sufixo = Date.now().toString(36).toUpperCase();
let seq = 0;
const novoCodigo = () => `T${sufixo}${++seq}`;
const hoje = () => new Date().toISOString().slice(0, 10);
const somaDias = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

async function criarCupom(dados: { dias?: number; valido_ate?: string; limite_usos?: number; ativo?: boolean } = {}) {
  const codigo = novoCodigo();
  const { error } = await adminClient().from("cupons").insert({ codigo, dias: 30, ...dados });
  expect(error).toBeNull();
  return codigo;
}

async function contaNova(rotulo: string) {
  const c = await signUpPsicologa(`cupom-${rotulo}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@teste.local`);
  return { ...c, cliente: userClient(c.accessToken) };
}

async function trialFim(id: string) {
  const { data } = await adminClient().from("assinaturas").select("trial_fim").eq("psicologa_id", id).single();
  return data!.trial_fim as string;
}

describe.skipIf(!hasLocalSupabase || !hasAdmin)("Banco: cupons", () => {
  it("ninguém lê a tabela de cupons nem aplica cupom em outra conta", async () => {
    const codigo = await criarCupom();
    const a = await contaNova("leitura");
    const { data } = await a.cliente.from("cupons").select("*");
    expect(data).toEqual([]);
    const direto = await a.cliente.rpc("aplicar_cupom", { p_psicologa_id: a.id, p_codigo: codigo });
    expect(direto.error).not.toBeNull();
    const anon = await anonClient().rpc("resgatar_cupom", { p_codigo: codigo });
    expect(anon.error).not.toBeNull();
  });

  it("teste correndo: soma os dias ao fim atual; um cupom por conta; resgate só visível para a dona", async () => {
    const codigo = await criarCupom({ dias: 30 });
    const outro = await criarCupom({ dias: 10 });
    const a = await contaNova("soma");
    const b = await contaNova("vizinha");
    const antes = await trialFim(a.id);

    expect((await a.cliente.rpc("resgatar_cupom", { p_codigo: codigo.toLowerCase() })).data).toBe("ok");
    expect(await trialFim(a.id)).toBe(somaDias(antes, 30));
    expect((await a.cliente.rpc("resgatar_cupom", { p_codigo: outro })).data).toBe("ja_usou");

    const { data: meus } = await a.cliente.from("cupom_resgates").select("psicologa_id");
    expect(meus).toHaveLength(1);
    const { data: daVizinha } = await b.cliente.from("cupom_resgates").select("psicologa_id");
    expect(daVizinha).toEqual([]);
  });

  it("cupom usado não pode ser apagado; sem uso pode; usuária não apaga nenhum", async () => {
    const admin = adminClient();
    const usado = await criarCupom();
    const livre = await criarCupom();
    const a = await contaNova("apagar");
    expect((await a.cliente.rpc("resgatar_cupom", { p_codigo: usado })).data).toBe("ok");

    await a.cliente.from("cupons").delete().eq("codigo", livre);
    expect((await admin.from("cupons").select("id").eq("codigo", livre)).data).toHaveLength(1);

    const bloqueado = await admin.from("cupons").delete().eq("codigo", usado);
    expect(bloqueado.error?.code).toBe("23503");
    expect((await admin.from("cupom_resgates").select("id").eq("psicologa_id", a.id)).data).toHaveLength(1);

    expect((await admin.from("cupons").delete().eq("codigo", livre)).error).toBeNull();
    expect((await admin.from("cupons").select("id").eq("codigo", livre)).data).toEqual([]);
  });

  it("teste vencido: conta a partir de hoje", async () => {
    const codigo = await criarCupom({ dias: 30 });
    const a = await contaNova("vencido");
    await adminClient().from("assinaturas").update({ trial_fim: somaDias(hoje(), -20) }).eq("psicologa_id", a.id);
    expect((await a.cliente.rpc("resgatar_cupom", { p_codigo: codigo })).data).toBe("ok");
    expect(await trialFim(a.id)).toBe(somaDias(hoje(), 30));
  });

  it("só para quem ainda não assinou", async () => {
    const codigo = await criarCupom();
    const assinou = await contaNova("assinou");
    await adminClient().from("assinaturas").update({ asaas_subscription_id: "sub_x" }).eq("psicologa_id", assinou.id);
    expect((await assinou.cliente.rpc("resgatar_cupom", { p_codigo: codigo })).data).toBe("ja_assinou");

    const cancelou = await contaNova("cancelou");
    await adminClient().from("assinaturas").update({ status: "cancelada" }).eq("psicologa_id", cancelou.id);
    expect((await cancelou.cliente.rpc("resgatar_cupom", { p_codigo: codigo })).data).toBe("ja_assinou");
  });

  it("inválido, pausado, vencido e esgotado", async () => {
    const a = await contaNova("regras");
    const pausado = await criarCupom({ ativo: false });
    const vencido = await criarCupom({ valido_ate: somaDias(hoje(), -1) });
    const unico = await criarCupom({ limite_usos: 1 });
    const outra = await contaNova("primeira");
    expect((await outra.cliente.rpc("resgatar_cupom", { p_codigo: unico })).data).toBe("ok");

    expect((await a.cliente.rpc("resgatar_cupom", { p_codigo: "NAOEXISTE123" })).data).toBe("invalido");
    expect((await a.cliente.rpc("resgatar_cupom", { p_codigo: pausado })).data).toBe("invalido");
    expect((await a.cliente.rpc("resgatar_cupom", { p_codigo: vencido })).data).toBe("expirado");
    expect((await a.cliente.rpc("resgatar_cupom", { p_codigo: unico })).data).toBe("esgotado");
  });

  it("dois resgates ao mesmo tempo não passam do limite", async () => {
    const codigo = await criarCupom({ limite_usos: 1 });
    const contas = await Promise.all([contaNova("corrida1"), contaNova("corrida2"), contaNova("corrida3")]);
    const resultados = await Promise.all(contas.map((c) => c.cliente.rpc("resgatar_cupom", { p_codigo: codigo })));
    const status = resultados.map((r) => r.data).sort();
    expect(status).toEqual(["esgotado", "esgotado", "ok"]);
  });

  it("10 códigos errados por hora bloqueiam novas tentativas", async () => {
    const codigo = await criarCupom();
    const a = await contaNova("chute");
    for (let i = 0; i < 10; i++) {
      expect((await a.cliente.rpc("resgatar_cupom", { p_codigo: `ERRADO${i}X` })).data).toBe("invalido");
    }
    expect((await a.cliente.rpc("resgatar_cupom", { p_codigo: codigo })).data).toBe("muitas_tentativas");
  });

  it("cupom no cadastro: aplica e deixa o aviso; cupom ruim não impede a conta", async () => {
    const codigo = await criarCupom({ dias: 30 });
    const anon = anonClient();
    const email = `cupom-cadastro-${Date.now()}@teste.local`;
    const { data, error } = await anon.auth.signUp({
      email,
      password: "senha-teste-123456",
      options: { data: { cupom: ` ${codigo.toLowerCase()} ` } },
    });
    expect(error).toBeNull();
    const id = data.user!.id;
    expect(await trialFim(id)).toBe(somaDias(hoje(), 37));
    const eu = userClient(data.session!.access_token);
    const { data: aviso } = await eu.from("cupom_avisos").select("codigo, status, lido_em").single();
    expect(aviso).toEqual({ codigo, status: "ok", lido_em: null });

    // Marca como lido, mas não reescreve o resultado.
    expect((await eu.from("cupom_avisos").update({ lido_em: new Date().toISOString() }).eq("psicologa_id", id)).error).toBeNull();
    const mexer = await eu.from("cupom_avisos").update({ status: "ok", codigo: "OUTRO" }).eq("psicologa_id", id);
    expect(mexer.error).not.toBeNull();

    const ruim = await anon.auth.signUp({
      email: `cupom-ruim-${Date.now()}@teste.local`,
      password: "senha-teste-123456",
      options: { data: { cupom: "NAOEXISTE999" } },
    });
    expect(ruim.error).toBeNull();
    expect(await trialFim(ruim.data.user!.id)).toBe(somaDias(hoje(), 7));
    const { data: avisoRuim } = await userClient(ruim.data.session!.access_token)
      .from("cupom_avisos")
      .select("status")
      .single();
    expect(avisoRuim?.status).toBe("invalido");
  });
});
