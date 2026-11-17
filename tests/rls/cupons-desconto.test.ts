import { describe, it, expect } from "vitest";
import {
  adminClient,
  anonClient,
  hasAdmin,
  hasLocalSupabase,
  signUpPsicologa,
  userClient,
} from "./_helpers";

// Migration 0031: cupons de desconto na assinatura.
const sufixo = Date.now().toString(36).toUpperCase();
let seq = 0;
const novoCodigo = () => `D${sufixo}${++seq}`;

async function criarDesconto(
  dados: {
    desconto_tipo?: "percentual" | "valor";
    desconto_valor?: number;
    desconto_meses?: number | null;
    limite_usos?: number;
    valido_ate?: string;
    ativo?: boolean;
  } = {},
) {
  const codigo = novoCodigo();
  const { error } = await adminClient()
    .from("cupons")
    .insert({ codigo, tipo: "desconto", desconto_tipo: "percentual", desconto_valor: 20, desconto_meses: 3, ...dados });
  expect(error).toBeNull();
  return codigo;
}

async function contaNova(rotulo: string) {
  const c = await signUpPsicologa(`desc-${rotulo}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@teste.local`);
  return { ...c, cliente: userClient(c.accessToken) };
}

/** Reserva o cupom e liga a uma assinatura do Asaas (como faz configurarAssinatura). */
async function assinarCom(conta: Awaited<ReturnType<typeof contaNova>>, codigo: string) {
  const { data } = await conta.cliente.rpc("reservar_cupom_desconto", { p_codigo: codigo });
  expect(data.status).toBe("ok");
  const sub = `sub_${conta.id.slice(0, 8)}_${Math.random().toString(36).slice(2, 6)}`;
  const admin = adminClient();
  await admin.from("cupom_descontos").update({ asaas_subscription_id: sub }).eq("id", data.reserva_id);
  await admin.from("assinaturas").update({ asaas_subscription_id: sub }).eq("psicologa_id", conta.id);
  return sub;
}

const meses = (sub: string, pagamento: string, mesesPlano: number, p = `${sufixo}_${pagamento}`) =>
  adminClient()
    .rpc("reservar_meses_desconto", { p_subscription_id: sub, p_payment_id: p, p_meses_plano: mesesPlano })
    .then((r) => r.data as { status: string; meses?: number });

describe.skipIf(!hasLocalSupabase || !hasAdmin)("Banco: cupons de desconto", () => {
  it("regras do cupom: cada tipo com os seus campos", async () => {
    const admin = adminClient();
    const misturado = await admin
      .from("cupons")
      .insert({ codigo: novoCodigo(), tipo: "dias", dias: 30, desconto_tipo: "percentual", desconto_valor: 10 });
    expect(misturado.error?.code).toBe("23514");
    const cem = await admin
      .from("cupons")
      .insert({ codigo: novoCodigo(), tipo: "desconto", desconto_tipo: "percentual", desconto_valor: 100 });
    expect(cem.error?.code).toBe("23514");
    const semValor = await admin.from("cupons").insert({ codigo: novoCodigo(), tipo: "desconto", desconto_tipo: "valor" });
    expect(semValor.error?.code).toBe("23514");
    // Cupom de dias continua igual (tipo padrão).
    expect((await admin.from("cupons").insert({ codigo: novoCodigo(), dias: 30 })).error).toBeNull();
  });

  it("funções do servidor fechadas para a usuária e para o visitante", async () => {
    const codigo = await criarDesconto();
    const a = await contaNova("fechado");
    expect((await a.cliente.rpc("reservar_meses_desconto", { p_subscription_id: "x", p_payment_id: "y", p_meses_plano: 1 })).error).not.toBeNull();
    expect((await a.cliente.rpc("devolver_meses_desconto", { p_payment_id: "y" })).error).not.toBeNull();
    expect((await a.cliente.rpc("validar_cupom_desconto", { p_psicologa_id: a.id, p_codigo: codigo })).error).not.toBeNull();
    expect((await anonClient().rpc("consultar_cupom_desconto", { p_codigo: codigo })).error).not.toBeNull();
    expect((await anonClient().rpc("reservar_cupom_desconto", { p_codigo: codigo })).error).not.toBeNull();
  });

  it("prévia mostra o desconto sem o id interno e sem reservar", async () => {
    const codigo = await criarDesconto({ desconto_valor: 15, desconto_meses: null });
    const a = await contaNova("previa");
    const { data } = await a.cliente.rpc("consultar_cupom_desconto", { p_codigo: codigo.toLowerCase() });
    expect(data).toEqual({ status: "ok", codigo, desconto_tipo: "percentual", desconto_valor: 15, desconto_meses: null });
    expect((await a.cliente.from("cupom_descontos").select("id")).data).toEqual([]);

    const dias = novoCodigo();
    await adminClient().from("cupons").insert({ codigo: dias, dias: 30 });
    expect((await a.cliente.rpc("consultar_cupom_desconto", { p_codigo: dias })).data.status).toBe("cupom_de_dias");
  });

  it("reserva: um por conta, visível só para a dona", async () => {
    const codigo = await criarDesconto();
    const outro = await criarDesconto();
    const a = await contaNova("reserva");
    const b = await contaNova("vizinha");

    const r1 = await a.cliente.rpc("reservar_cupom_desconto", { p_codigo: codigo });
    expect(r1.data.status).toBe("ok");
    // Reserva recente ainda sem assinatura: outra tentativa espera.
    expect((await a.cliente.rpc("reservar_cupom_desconto", { p_codigo: outro })).data.status).toBe("em_andamento");

    await adminClient().from("cupom_descontos").update({ asaas_subscription_id: "sub_a" }).eq("id", r1.data.reserva_id);
    expect((await a.cliente.rpc("consultar_cupom_desconto", { p_codigo: outro })).data.status).toBe("ja_usou");

    expect((await a.cliente.from("cupom_descontos").select("codigo")).data).toEqual([{ codigo }]);
    expect((await b.cliente.from("cupom_descontos").select("codigo")).data).toEqual([]);
    // A usuária não escreve nem lê as cobranças com desconto.
    expect((await a.cliente.from("cupom_descontos").update({ meses_usados: 0 }).eq("id", r1.data.reserva_id).select()).data ?? []).toEqual([]);
    expect((await a.cliente.from("cobrancas_desconto").select("*")).data).toEqual([]);
  });

  it("quem tem assinatura em vigor não reserva; quem cancelou pode", async () => {
    const codigo = await criarDesconto();
    const ativa = await contaNova("ativa");
    await adminClient().from("assinaturas").update({ asaas_subscription_id: "sub_y", status: "ativa" }).eq("psicologa_id", ativa.id);
    expect((await ativa.cliente.rpc("reservar_cupom_desconto", { p_codigo: codigo })).data.status).toBe("ja_assinou");

    const cancelou = await contaNova("cancelou");
    await adminClient().from("assinaturas").update({ asaas_subscription_id: "sub_z", status: "cancelada" }).eq("psicologa_id", cancelou.id);
    expect((await cancelou.cliente.rpc("reservar_cupom_desconto", { p_codigo: codigo })).data.status).toBe("ok");
  });

  it("vencido, pausado, esgotado; reservas ao mesmo tempo não passam do limite", async () => {
    const a = await contaNova("regras");
    const ontem = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    expect((await a.cliente.rpc("reservar_cupom_desconto", { p_codigo: await criarDesconto({ valido_ate: ontem }) })).data.status).toBe("expirado");
    expect((await a.cliente.rpc("reservar_cupom_desconto", { p_codigo: await criarDesconto({ ativo: false }) })).data.status).toBe("invalido");

    const unico = await criarDesconto({ limite_usos: 1 });
    const contas = await Promise.all([contaNova("c1"), contaNova("c2"), contaNova("c3")]);
    const status = (await Promise.all(contas.map((c) => c.cliente.rpc("reservar_cupom_desconto", { p_codigo: unico }))))
      .map((r) => r.data.status)
      .sort();
    expect(status).toEqual(["esgotado", "esgotado", "ok"]);
  });

  it("cupom de desconto no cadastro e em 'Tenho um cupom' não mexe no teste", async () => {
    const codigo = await criarDesconto();
    const a = await contaNova("dias");
    const antes = (await adminClient().from("assinaturas").select("trial_fim").eq("psicologa_id", a.id).single()).data!.trial_fim;
    expect((await a.cliente.rpc("resgatar_cupom", { p_codigo: codigo })).data).toBe("cupom_de_desconto");
    expect((await adminClient().from("assinaturas").select("trial_fim").eq("psicologa_id", a.id).single()).data!.trial_fim).toBe(antes);
    // E ainda pode usar um cupom de dias depois (um de cada tipo).
    const dias = novoCodigo();
    await adminClient().from("cupons").insert({ codigo: dias, dias: 10 });
    expect((await a.cliente.rpc("resgatar_cupom", { p_codigo: dias })).data).toBe("ok");

    const { data, error } = await anonClient().auth.signUp({
      email: `desc-cadastro-${Date.now()}@teste.local`,
      password: "senha-teste-123456",
      options: { data: { cupom: codigo } },
    });
    expect(error).toBeNull();
    const { data: aviso } = await userClient(data.session!.access_token).from("cupom_avisos").select("codigo, status").single();
    expect(aviso).toEqual({ codigo, status: "cupom_de_desconto" });
  });

  it("meses por cobrança: mensal gasta 1 por vez, uma vez por cobrança", async () => {
    const a = await contaNova("mensal");
    const sub = await assinarCom(a, await criarDesconto({ desconto_meses: 3 }));
    expect(await meses(sub, "pay_1", 1)).toMatchObject({ status: "ok", meses: 1 });
    expect(await meses(sub, "pay_1", 1)).toEqual({ status: "ja_aplicado" });
    expect(await meses(sub, "pay_2", 1)).toMatchObject({ status: "ok", meses: 1 });
    expect(await meses(sub, "pay_3", 1)).toMatchObject({ status: "ok", meses: 1 });
    expect(await meses(sub, "pay_4", 1)).toEqual({ status: "esgotado" });

    // Asaas recusou a troca do 3º: devolve o mês, e o 4º passa a ter desconto.
    await adminClient().rpc("devolver_meses_desconto", { p_payment_id: `${sufixo}_pay_3` });
    expect(await meses(sub, "pay_4", 1)).toMatchObject({ status: "ok", meses: 1 });
  });

  it("meses por cobrança: trimestral com 5 meses = 3 + 2; para sempre não mexe", async () => {
    const a = await contaNova("trim");
    const sub = await assinarCom(a, await criarDesconto({ desconto_meses: 5 }));
    expect(await meses(sub, "t_1", 3)).toMatchObject({ status: "ok", meses: 3, desconto_tipo: "percentual", desconto_valor: 20 });
    expect(await meses(sub, "t_2", 3)).toMatchObject({ status: "ok", meses: 2 });
    expect(await meses(sub, "t_3", 3)).toEqual({ status: "esgotado" });

    const b = await contaNova("sempre");
    const subB = await assinarCom(b, await criarDesconto({ desconto_meses: null }));
    expect(await meses(subB, "s_1", 1)).toEqual({ status: "permanente" });
    expect(await meses("sub_sem_cupom", "x_1", 1)).toEqual({ status: "sem_desconto" });
  });

  it("cupom usado não pode ser apagado", async () => {
    const codigo = await criarDesconto();
    const a = await contaNova("apagar");
    await assinarCom(a, codigo);
    expect((await adminClient().from("cupons").delete().eq("codigo", codigo)).error?.code).toBe("23503");
  });
});
