import { describe, it, expect } from "vitest";
import {
  hasLocalSupabase,
  userClient,
  signUpPsicologa,
} from "./_helpers";

// Teste de integração de isolamento multi-tenant (RLS).
// Requer Supabase local (`npx supabase start` + `npx supabase db reset`) e
// SUPABASE_TEST_URL/ANON_KEY. Sem isso, é pulado — não roda contra produção.
describe.skipIf(!hasLocalSupabase)("RLS: psicologas", () => {
  it("psicóloga A não consegue ler o perfil da psicóloga B", async () => {
    const suffix = Date.now();
    const a = await signUpPsicologa(`psicologa-a-${suffix}@teste.local`);
    const b = await signUpPsicologa(`psicologa-b-${suffix}@teste.local`);

    const clientA = userClient(a.accessToken);

    const { data: crossRead, error: crossError } = await clientA
      .from("psicologas")
      .select("*")
      .eq("id", b.id);

    expect(crossError).toBeNull();
    expect(crossRead).toEqual([]);

    const { data: ownRead } = await clientA
      .from("psicologas")
      .select("*")
      .eq("id", a.id);

    expect(ownRead).toHaveLength(1);
  });

  it("psicóloga A não consegue editar o perfil da psicóloga B", async () => {
    const suffix = Date.now();
    const a = await signUpPsicologa(`psicologa-a2-${suffix}@teste.local`);
    const b = await signUpPsicologa(`psicologa-b2-${suffix}@teste.local`);

    const clientA = userClient(a.accessToken);
    const clientB = userClient(b.accessToken);

    const { data: updated, error: updateError } = await clientA
      .from("psicologas")
      .update({ nome: "invadido" })
      .eq("id", b.id)
      .select();

    expect(updateError).toBeNull();
    expect(updated).toEqual([]);

    const { data: bRow } = await clientB
      .from("psicologas")
      .select("nome")
      .eq("id", b.id)
      .single();

    expect(bRow?.nome).not.toBe("invadido");
  });
});
