import { describe, it, expect } from "vitest";
import { hasLocalSupabase, userClient, signUpPsicologa } from "./_helpers";

// Só service_role escreve google_oauth_tokens (no callback de auth). As
// psicólogas só podem ler / apagar a própria linha.
describe.skipIf(!hasLocalSupabase)("RLS: google_oauth_tokens", () => {
  it("psicóloga não consegue inserir token (sem policy de insert)", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`gt-a-${s}@teste.local`);
    const ca = userClient(a.accessToken);

    const { error } = await ca.from("google_oauth_tokens").insert({
      psicologa_id: a.id,
      refresh_token_cifrado: "iv:enc:tag",
    });
    expect(error).not.toBeNull();
  });

  it("A não lê o token de B e não apaga o de B", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`gt-a2-${s}@teste.local`);
    const b = await signUpPsicologa(`gt-b2-${s}@teste.local`);
    const ca = userClient(a.accessToken);

    const { data: lido } = await ca.from("google_oauth_tokens").select("*");
    expect(lido).toEqual([]);

    // delete de A mirando a linha de B não afeta nada (nem existe p/ ela).
    const { data: apagado } = await ca
      .from("google_oauth_tokens")
      .delete()
      .eq("psicologa_id", b.id)
      .select();
    expect(apagado ?? []).toEqual([]);
  });
});
