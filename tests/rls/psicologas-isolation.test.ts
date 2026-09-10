import { describe, it, expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Teste de integração de isolamento multi-tenant (RLS).
// Requer uma instância local do Supabase rodando (`npx supabase start`)
// com as migrations aplicadas (`npx supabase db reset`).
// Sem SUPABASE_TEST_URL/ANON_KEY locais, o teste é pulado — não roda contra produção.
const url = process.env.SUPABASE_TEST_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const hasLocalSupabase = Boolean(url && anonKey);

// Client anônimo sem persistência de sessão — usado só para signUp.
function anonClient(): SupabaseClient {
  return createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Client autenticado como um usuário específico, via bearer token explícito.
// Evita o compartilhamento de storage entre instâncias do GoTrueClient no jsdom.
function userClient(accessToken: string): SupabaseClient {
  return createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

async function signUpPsicologa(email: string, password: string) {
  const { data, error } = await anonClient().auth.signUp({ email, password });
  expect(error).toBeNull();
  expect(data.session).not.toBeNull();
  return { id: data.user!.id, accessToken: data.session!.access_token };
}

describe.skipIf(!hasLocalSupabase)("RLS: psicologas", () => {
  const password = "senha-teste-123456";

  it("psicóloga A não consegue ler o perfil da psicóloga B", async () => {
    const suffix = Date.now();
    const a = await signUpPsicologa(`psicologa-a-${suffix}@teste.local`, password);
    const b = await signUpPsicologa(`psicologa-b-${suffix}@teste.local`, password);

    const clientA = userClient(a.accessToken);

    // A tenta ler o perfil de B diretamente pelo id.
    const { data: crossRead, error: crossError } = await clientA
      .from("psicologas")
      .select("*")
      .eq("id", b.id);

    expect(crossError).toBeNull();
    expect(crossRead).toEqual([]);

    // Sanidade: a policy não bloqueia tudo — A lê o próprio perfil.
    const { data: ownRead } = await clientA
      .from("psicologas")
      .select("*")
      .eq("id", a.id);

    expect(ownRead).toHaveLength(1);
  });

  it("psicóloga A não consegue editar o perfil da psicóloga B", async () => {
    const suffix = Date.now();
    const a = await signUpPsicologa(`psicologa-a2-${suffix}@teste.local`, password);
    const b = await signUpPsicologa(`psicologa-b2-${suffix}@teste.local`, password);

    const clientA = userClient(a.accessToken);
    const clientB = userClient(b.accessToken);

    // Update de A sobre a linha de B: RLS não deixa a linha visível, então
    // nenhuma linha é afetada (data vazio), sem erro.
    const { data: updated, error: updateError } = await clientA
      .from("psicologas")
      .update({ nome: "invadido" })
      .eq("id", b.id)
      .select();

    expect(updateError).toBeNull();
    expect(updated).toEqual([]);

    // B confirma que o próprio nome não mudou.
    const { data: bRow } = await clientB
      .from("psicologas")
      .select("nome")
      .eq("id", b.id)
      .single();

    expect(bRow?.nome).not.toBe("invadido");
  });
});
