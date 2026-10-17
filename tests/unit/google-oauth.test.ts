import { describe, it, expect, vi, afterEach } from "vitest";
import { pedidoGoogleValido, trocarCodigoGoogle } from "@/lib/google/oauth";

describe("pedidoGoogleValido (anti login CSRF)", () => {
  const origem = "https://app.gradatim.com.br";
  const state = "a".repeat(64);

  it("aceita mesma origem e state igual ao do cookie", () => {
    expect(pedidoGoogleValido(origem, origem, state, state)).toBe(true);
  });

  it("recusa outra origem, mesmo com state certo", () => {
    expect(pedidoGoogleValido("https://evil.example", origem, state, state)).toBe(false);
    expect(pedidoGoogleValido(null, origem, state, state)).toBe(false);
  });

  it("recusa state ausente, curto ou diferente do cookie", () => {
    expect(pedidoGoogleValido(origem, origem, state, undefined)).toBe(false);
    expect(pedidoGoogleValido(origem, origem, "b".repeat(64), state)).toBe(false);
    expect(pedidoGoogleValido(origem, origem, "curto", "curto")).toBe(false);
    expect(pedidoGoogleValido(origem, origem, 123, "123")).toBe(false);
  });
});

describe("trocarCodigoGoogle", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("manda redirect_uri postmessage e devolve id_token, refresh_token e escopo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ id_token: "idt", refresh_token: "rt", scope: "openid email" }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const r = await trocarCodigoGoogle("codigo");
    expect(r).toEqual({ idToken: "idt", refreshToken: "rt", scope: "openid email" });
    const corpo = new URLSearchParams(fetchMock.mock.calls[0][1].body as URLSearchParams);
    expect(corpo.get("redirect_uri")).toBe("postmessage");
    expect(corpo.get("grant_type")).toBe("authorization_code");
    expect(corpo.get("code")).toBe("codigo");
  });

  it("lança em resposta de erro do Google", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 400 })));
    await expect(trocarCodigoGoogle("x")).rejects.toThrow();
  });
});
