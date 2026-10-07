import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mensagemErroEscrita,
  MSG_SOMENTE_LEITURA,
  MSG_SEM_PERMISSAO,
} from "@/lib/assinatura/guard";

// Só o que mensagemErroEscrita usa: getUser e a rpc da trava.
function fakeSupabase(permite: boolean | null) {
  let rpcs = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    rpc: async () => {
      rpcs++;
      return { data: permite };
    },
  } as unknown as SupabaseClient;
  return { client, rpcs: () => rpcs };
}

describe("mensagemErroEscrita", () => {
  it("erro comum usa a mensagem padrão sem consultar o banco", async () => {
    const f = fakeSupabase(false);
    expect(await mensagemErroEscrita(f.client, { code: "23505" }, "padrão")).toBe("padrão");
    expect(f.rpcs()).toBe(0);
  });

  it("policy barrada pela trava de assinatura explica o somente leitura", async () => {
    const f = fakeSupabase(false);
    expect(await mensagemErroEscrita(f.client, { code: "42501" }, "padrão")).toBe(MSG_SOMENTE_LEITURA);
  });

  it("policy barrada por outro motivo não culpa a assinatura", async () => {
    expect(await mensagemErroEscrita(fakeSupabase(true).client, { code: "42501" }, "padrão")).toBe(
      MSG_SEM_PERMISSAO,
    );
    expect(await mensagemErroEscrita(fakeSupabase(null).client, { code: "42501" }, "padrão")).toBe(
      MSG_SEM_PERMISSAO,
    );
  });
});
