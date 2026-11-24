import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { DOCX, formatarTamanho, mimeValido, nomeDoArquivo, tipoValido } from "@/lib/documentos/tipos";
import { documentoDadosSchema, iniciarEnvioSchema } from "@/lib/documentos/schema";
import { ehFoto } from "@/lib/documentos/comprimir";
import { gerarProntuarioPdf } from "@/lib/exportacao/prontuarioPdf";
import type { Paciente } from "@/lib/pacientes/types";

// Entrega G (0041): documentos do paciente.

describe("documentos: utilitários", () => {
  it("tamanho legível", () => {
    expect(formatarTamanho(0)).toBe("0 KB");
    expect(formatarTamanho(300)).toBe("1 KB");
    expect(formatarTamanho(350 * 1024)).toBe("350 KB");
    expect(formatarTamanho(4.2 * 1024 * 1024)).toBe("4,2 MB");
    expect(formatarTamanho(100 * 1024 * 1024)).toBe("100 MB");
  });

  it("nome do arquivo para baixar: extensão certa e sem caracteres proibidos", () => {
    expect(nomeDoArquivo("Atestado escolar", "application/pdf")).toBe("Atestado escolar.pdf");
    expect(nomeDoArquivo("laudo.pdf", "application/pdf")).toBe("laudo.pdf");
    expect(nomeDoArquivo('a/b:c*"d', "image/jpeg")).toBe("a b c d.jpg");
    expect(nomeDoArquivo("   ", DOCX)).toBe("documento.docx");
  });

  it("tipos e formatos aceitos", () => {
    expect(mimeValido("application/pdf")).toBe(true);
    expect(mimeValido(DOCX)).toBe(true);
    expect(mimeValido("image/svg+xml")).toBe(false);
    expect(mimeValido("text/html")).toBe(false);
    expect(tipoValido("laudo")).toBe(true);
    expect(tipoValido("receita")).toBe(false);
  });

  it("o que é foto (vai ser comprimida)", () => {
    const f = (name: string, type: string) => ({ name, type }) as File;
    expect(ehFoto(f("a.jpg", "image/jpeg"))).toBe(true);
    expect(ehFoto(f("IMG_1.HEIC", ""))).toBe(true);
    expect(ehFoto(f("a.pdf", "application/pdf"))).toBe(false);
  });
});

describe("documentos: validação", () => {
  const base = { nome: " Atestado ", tipo: "atestado", data_documento: "2026-11-24", finalidade: " ", destinatario: "Escola X" };

  it("dados: nome obrigatório, opcionais vazios viram null", () => {
    expect(documentoDadosSchema.parse(base)).toEqual({
      nome: "Atestado", tipo: "atestado", data_documento: "2026-11-24", finalidade: null, destinatario: "Escola X",
    });
    expect(documentoDadosSchema.safeParse({ ...base, nome: "  " }).success).toBe(false);
    expect(documentoDadosSchema.safeParse({ ...base, tipo: "receita" }).success).toBe(false);
  });

  it("envio: só PDF, JPG, PNG e DOCX, até 10 MB", () => {
    const ok = { ...base, mime: "application/pdf", tamanho: 1000 };
    expect(iniciarEnvioSchema.safeParse(ok).success).toBe(true);
    expect(iniciarEnvioSchema.safeParse({ ...ok, mime: "text/html" }).success).toBe(false);
    expect(iniciarEnvioSchema.safeParse({ ...ok, tamanho: 10 * 1024 * 1024 + 1 }).success).toBe(false);
    expect(iniciarEnvioSchema.safeParse({ ...ok, tamanho: 0 }).success).toBe(false);
  });
});

describe("PDF do prontuário lista os documentos", () => {
  it("gera com a seção de documentos", async () => {
    const paciente = { id: "p", nome: "Maria", status: "ativo", created_at: "2026-01-01T00:00:00Z" } as unknown as Paciente;
    const bytes = await gerarProntuarioPdf({
      psicologa: { nome: "Ana", crp: null },
      paciente,
      anamnese: null,
      evolucoes: [],
      documentos: [
        { nome: "Atestado escolar", tipo: "Atestado", data_documento: "2026-11-20", finalidade: "Escola", destinatario: "Escola X", sessao: null, arquivado: false },
        { nome: "Exame", tipo: "Documento do paciente", data_documento: "2026-10-01", finalidade: null, destinatario: null, sessao: "2026-10-01", arquivado: true },
      ],
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
