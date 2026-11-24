// Documentos do paciente (entrega G, migration 0041). Puro: usado no servidor,
// no navegador (envio) e nas exportações.

export const TIPOS_DOCUMENTO = {
  atestado: "Atestado",
  declaracao: "Declaração",
  laudo: "Laudo/Relatório",
  encaminhamento: "Encaminhamento",
  documento_paciente: "Documento do paciente",
  outro: "Outro",
} as const;
export type TipoDocumento = keyof typeof TIPOS_DOCUMENTO;

export const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Tipos guardados (os mesmos do bucket e do CHECK). Fotos chegam aqui já em JPEG. */
export const MIMES_DOCUMENTO = ["application/pdf", "image/jpeg", "image/png", DOCX] as const;
export type MimeDocumento = (typeof MIMES_DOCUMENTO)[number];

export const EXTENSAO: Record<MimeDocumento, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  [DOCX]: "docx",
};

/** O que o seletor de arquivo aceita (HEIC entra para o Safari converter em JPEG). */
export const ACEITA_ARQUIVO = ".pdf,.docx,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png,image/heic,image/heif," + DOCX;

export function mimeValido(v: unknown): v is MimeDocumento {
  return typeof v === "string" && (MIMES_DOCUMENTO as readonly string[]).includes(v);
}

export function tipoValido(v: unknown): v is TipoDocumento {
  return typeof v === "string" && Object.hasOwn(TIPOS_DOCUMENTO, v);
}

/** "350 KB", "4,2 MB". */
export function formatarTamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toLocaleString("pt-BR", { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`;
}

/** Nome do arquivo para baixar: "Atestado escolar.pdf" (sem caracteres que quebram o sistema de arquivos). */
export function nomeDoArquivo(nome: string, mime: string): string {
  const base = nome.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "documento";
  const ext = mimeValido(mime) ? EXTENSAO[mime] : "bin";
  return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;
}

export type Documento = {
  id: string;
  paciente_id: string;
  evolucao_id: string | null;
  nome: string;
  tipo: TipoDocumento;
  data_documento: string;
  finalidade: string | null;
  destinatario: string | null;
  mime: MimeDocumento;
  tamanho: number;
  enviado_em: string | null;
  deleted_at: string | null;
};

export const MSG_COTA =
  "O espaço de documentos da sua conta acabou. Fale com o suporte em contato@gradatim.com.br.";
