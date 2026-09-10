import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

// AES-256-GCM para segredos guardados no banco (refresh token do Google).
// Chave em GOOGLE_TOKEN_ENC_KEY: 32 bytes em base64. Ausência => cripto indisponível.

function getKey(): Buffer | null {
  const raw = process.env.GOOGLE_TOKEN_ENC_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("GOOGLE_TOKEN_ENC_KEY precisa ter 32 bytes em base64");
  }
  return key;
}

export function cryptoDisponivel(): boolean {
  return getKey() !== null;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) throw new Error("GOOGLE_TOKEN_ENC_KEY não configurada");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    enc.toString("base64"),
    tag.toString("base64"),
  ].join(":");
}

export function decrypt(payload: string): string {
  const key = getKey();
  if (!key) throw new Error("GOOGLE_TOKEN_ENC_KEY não configurada");
  const [ivB64, encB64, tagB64] = payload.split(":");
  if (!ivB64 || !encB64 || !tagB64) {
    throw new Error("payload cifrado malformado");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
