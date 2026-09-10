import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";

let encrypt: typeof import("@/lib/crypto").encrypt;
let decrypt: typeof import("@/lib/crypto").decrypt;
let cryptoDisponivel: typeof import("@/lib/crypto").cryptoDisponivel;

beforeAll(async () => {
  process.env.GOOGLE_TOKEN_ENC_KEY = randomBytes(32).toString("base64");
  ({ encrypt, decrypt, cryptoDisponivel } = await import("@/lib/crypto"));
});

describe("crypto AES-256-GCM", () => {
  it("round-trip devolve o texto original", () => {
    const segredo = "1//0abcRefreshTokenDoGoogle-xyz";
    expect(decrypt(encrypt(segredo))).toBe(segredo);
  });

  it("dois encrypts do mesmo texto produzem payloads diferentes (IV aleatório)", () => {
    expect(encrypt("igual")).not.toBe(encrypt("igual"));
  });

  it("payload adulterado falha na verificação da tag", () => {
    const p = encrypt("dados");
    const [iv, enc, tag] = p.split(":");
    const encAdulterado = Buffer.from(enc, "base64");
    encAdulterado[0] ^= 0xff;
    const ruim = [iv, encAdulterado.toString("base64"), tag].join(":");
    expect(() => decrypt(ruim)).toThrow();
  });

  it("cryptoDisponivel reflete a presença da chave", () => {
    expect(cryptoDisponivel()).toBe(true);
  });
});
