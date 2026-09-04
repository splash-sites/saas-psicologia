import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

// Teste de integração de isolamento multi-tenant (RLS).
// Requer uma instância local do Supabase rodando (`npx supabase start`)
// com as migrations aplicadas (`npx supabase db reset`).
// Sem SUPABASE_URL/ANON_KEY locais, o teste é pulado — não roda contra produção.
const url = process.env.SUPABASE_TEST_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const hasLocalSupabase = Boolean(url && anonKey);

describe.skipIf(!hasLocalSupabase)("RLS: psicologas", () => {
  let emailA: string;
  let emailB: string;
  const password = "senha-teste-123456";

  beforeAll(() => {
    const suffix = Date.now();
    emailA = `psicologa-a-${suffix}@teste.local`;
    emailB = `psicologa-b-${suffix}@teste.local`;
  });

  it("uma psicóloga nunca consegue ler o perfil de outra", async () => {
    const clientA = createClient(url!, anonKey!);
    const clientB = createClient(url!, anonKey!);

    const { data: signUpA, error: errorA } = await clientA.auth.signUp({
      email: emailA,
      password,
    });
    expect(errorA).toBeNull();

    const { data: signUpB, error: errorB } = await clientB.auth.signUp({
      email: emailB,
      password,
    });
    expect(errorB).toBeNull();

    const idB = signUpB.user!.id;

    // Psicóloga A autenticada tenta ler o perfil da psicóloga B diretamente pelo id.
    const { data: crossRead, error: crossError } = await clientA
      .from("psicologas")
      .select("*")
      .eq("id", idB);

    expect(crossError).toBeNull();
    expect(crossRead).toEqual([]);

    // Confirma que a policy não está apenas bloqueando tudo: A lê o próprio perfil.
    const { data: ownRead } = await clientA
      .from("psicologas")
      .select("*")
      .eq("id", signUpA.user!.id);

    expect(ownRead).toHaveLength(1);
  });
});
