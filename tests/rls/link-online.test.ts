import { describe, it, expect } from "vitest";
import { hasLocalSupabase, userClient, signUpPsicologa } from "./_helpers";

// Migration 0018: link fixo de atendimento online em psicologas.
describe.skipIf(!hasLocalSupabase)("Banco: link de atendimento online", () => {
  it("salva https, recusa link inválido e B não altera o link de A", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`link-a-${s}@teste.local`);
    const b = await signUpPsicologa(`link-b-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const cb = userClient(b.accessToken);

    const ok = await ca
      .from("psicologas")
      .update({ link_atendimento_online: "https://meet.google.com/abc-defg-hij" })
      .eq("id", a.id);
    expect(ok.error).toBeNull();

    for (const ruim of ["javascript:alert(1)", "http://zoom.us/j/1", "https://com espaço"]) {
      const r = await ca
        .from("psicologas")
        .update({ link_atendimento_online: ruim })
        .eq("id", a.id);
      expect(r.error, ruim).not.toBeNull();
    }

    // B tenta trocar o link de A: a policy filtra a linha, nada muda.
    const { data: alteradas } = await cb
      .from("psicologas")
      .update({ link_atendimento_online: "https://evil.example/x" })
      .eq("id", a.id)
      .select("id");
    expect(alteradas).toEqual([]);

    const { data } = await ca
      .from("psicologas")
      .select("link_atendimento_online")
      .eq("id", a.id)
      .single();
    expect(data!.link_atendimento_online).toBe("https://meet.google.com/abc-defg-hij");
  });
});
