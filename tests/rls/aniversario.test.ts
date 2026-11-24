import { describe, it, expect } from "vitest";
import { hasLocalSupabase, userClient, signUpPsicologa } from "./_helpers";

// Item H (0040): mensagem de parabéns na própria linha de psicologas.

async function conta(prefixo: string) {
  const s = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const u = await signUpPsicologa(`${prefixo}-${s}@teste.local`);
  return { u, c: userClient(u.accessToken) };
}

describe.skipIf(!hasLocalSupabase)("Aniversário (0040)", () => {
  it("grava a mensagem; acima de 1000 caracteres o banco recusa", async () => {
    const { u, c } = await conta("aniv1");
    const ok = await c.from("psicologas").update({ mensagem_aniversario: "Parabéns, {nome}!" }).eq("id", u.id).select("mensagem_aniversario").single();
    expect(ok.data?.mensagem_aniversario).toBe("Parabéns, {nome}!");
    const longa = await c.from("psicologas").update({ mensagem_aniversario: "x".repeat(1001) }).eq("id", u.id);
    expect(longa.error?.code).toBe("23514");
  });

  it("isolamento: outra conta não muda a mensagem", async () => {
    const a = await conta("aniv2a");
    const b = await conta("aniv2b");
    const { data } = await b.c.from("psicologas").update({ mensagem_aniversario: "invadido" }).eq("id", a.u.id).select("id");
    expect(data ?? []).toHaveLength(0);
    const { data: lida } = await a.c.from("psicologas").select("mensagem_aniversario").eq("id", a.u.id).single();
    expect(lida?.mensagem_aniversario).toBeNull();
  });
});
