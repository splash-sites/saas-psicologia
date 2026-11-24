// Compressão de fotos no navegador antes do envio (decisão de 2026-11-23):
// lado maior até 2000 px, JPEG 80%. HEIC (iPhone) vira JPEG quando o navegador
// sabe abrir (Safari). A original não é guardada. PDF e DOCX vão como estão.

const LADO_MAX = 2000;
const QUALIDADE = 0.8;

export function ehFoto(arquivo: File): boolean {
  return /^image\/(jpeg|png|heic|heif)$/i.test(arquivo.type) || /\.(jpe?g|png|heic|heif)$/i.test(arquivo.name);
}

async function carregar(arquivo: File): Promise<{ largura: number; altura: number; desenhar: (c: CanvasRenderingContext2D, l: number, a: number) => void; fechar: () => void }> {
  if ("createImageBitmap" in window) {
    try {
      const bmp = await createImageBitmap(arquivo);
      return {
        largura: bmp.width,
        altura: bmp.height,
        desenhar: (c, l, a) => c.drawImage(bmp, 0, 0, l, a),
        fechar: () => bmp.close(),
      };
    } catch {
      // cai no <img> (Safari antigo com HEIC)
    }
  }
  const url = URL.createObjectURL(arquivo);
  const img = new Image();
  await new Promise<void>((ok, erro) => {
    img.onload = () => ok();
    img.onerror = () => erro(new Error("imagem"));
    img.src = url;
  });
  return {
    largura: img.naturalWidth,
    altura: img.naturalHeight,
    desenhar: (c, l, a) => c.drawImage(img, 0, 0, l, a),
    fechar: () => URL.revokeObjectURL(url),
  };
}

/**
 * Foto reduzida em JPEG. Se a "comprimida" ficar maior que a original (JPEG ou
 * PNG pequenos), manda a original. Lança erro se o navegador não abre a imagem.
 */
export async function comprimirFoto(arquivo: File): Promise<{ blob: Blob; mime: "image/jpeg" | "image/png" }> {
  const img = await carregar(arquivo);
  try {
    const escala = Math.min(1, LADO_MAX / Math.max(img.largura, img.altura));
    const l = Math.max(1, Math.round(img.largura * escala));
    const a = Math.max(1, Math.round(img.altura * escala));
    const canvas = document.createElement("canvas");
    canvas.width = l;
    canvas.height = a;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    // Fundo branco: PNG com transparência não fica preto no JPEG.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, l, a);
    img.desenhar(ctx, l, a);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", QUALIDADE));
    if (!blob) throw new Error("toBlob");
    const original = arquivo.type === "image/jpeg" || arquivo.type === "image/png" ? arquivo.type : null;
    if (original && escala === 1 && arquivo.size <= blob.size) return { blob: arquivo, mime: original };
    return { blob, mime: "image/jpeg" };
  } finally {
    img.fechar();
  }
}
