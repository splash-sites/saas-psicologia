import { describe, it, expect } from "vitest";
import { conteudoConfere } from "@/lib/documentos/conteudo";
import { DOCX } from "@/lib/documentos/tipos";

const bytes = (...b: number[]) => new Uint8Array(b);
const texto = (s: string) => new TextEncoder().encode(s);

describe("conteudoConfere (primeiros bytes do documento)", () => {
  it("aceita cada tipo com a assinatura certa", () => {
    expect(conteudoConfere("image/jpeg", bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toBe(true);
    expect(conteudoConfere("image/png", bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe(true);
    expect(conteudoConfere(DOCX, bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0))).toBe(true);
    expect(conteudoConfere("application/pdf", texto("%PDF-1.7\n%âãÏÓ"))).toBe(true);
    // Lixo antes do cabeçalho é permitido pela especificação do PDF.
    expect(conteudoConfere("application/pdf", texto("\r\n\r\n%PDF-1.4"))).toBe(true);
  });

  it("recusa arquivo com outro conteúdo (renomeado)", () => {
    const html = texto("<!doctype html><script>alert(1)</script>");
    expect(conteudoConfere("application/pdf", html)).toBe(false);
    expect(conteudoConfere("image/jpeg", html)).toBe(false);
    expect(conteudoConfere("image/png", html)).toBe(false);
    expect(conteudoConfere(DOCX, html)).toBe(false);
    // PNG declarado como JPEG e vice-versa.
    expect(conteudoConfere("image/jpeg", bytes(0x89, 0x50, 0x4e, 0x47))).toBe(false);
    expect(conteudoConfere("image/png", bytes(0xff, 0xd8, 0xff))).toBe(false);
    // Executável do Windows ("MZ").
    expect(conteudoConfere(DOCX, bytes(0x4d, 0x5a, 0x90, 0))).toBe(false);
  });

  it("recusa arquivo vazio ou curto demais", () => {
    expect(conteudoConfere("image/png", bytes(0x89, 0x50))).toBe(false);
    expect(conteudoConfere("application/pdf", bytes())).toBe(false);
  });
});
