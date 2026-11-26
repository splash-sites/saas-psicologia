// O bucket só aceita PDF, JPG, PNG e DOCX, mas confere o tipo que o navegador
// DECLARA no envio. Aqui conferimos os primeiros bytes do arquivo que chegou
// (auditoria de segurança de 2026-11-26): um HTML ou executável renomeado para
// .pdf não passa. Puro, testável sem Storage.

import { DOCX, type MimeDocumento } from "@/lib/documentos/tipos";

/** Quantos bytes do começo do arquivo ler para conferir. */
export const BYTES_CONFERIDOS = 1024;

const comeca = (b: Uint8Array, assinatura: number[]) =>
  b.length >= assinatura.length && assinatura.every((x, i) => b[i] === x);

export function conteudoConfere(mime: MimeDocumento, bytes: Uint8Array): boolean {
  switch (mime) {
    case "image/jpeg":
      return comeca(bytes, [0xff, 0xd8, 0xff]);
    case "image/png":
      return comeca(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case DOCX:
      // DOCX é um ZIP: "PK\x03\x04".
      return comeca(bytes, [0x50, 0x4b, 0x03, 0x04]);
    case "application/pdf": {
      // A especificação aceita lixo antes do "%PDF-" (até 1024 bytes).
      const inicio = new TextDecoder("latin1").decode(bytes.subarray(0, BYTES_CONFERIDOS));
      return inicio.includes("%PDF-");
    }
    default:
      return false;
  }
}
