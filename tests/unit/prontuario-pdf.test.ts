import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { gerarProntuarioPdf, quebrarLinhas, textoSeguro } from "@/lib/exportacao/prontuarioPdf";
import type { Paciente } from "@/lib/pacientes/types";
import type { Evolucao } from "@/lib/prontuario/types";

const paciente: Paciente = {
  id: "p1", psicologa_id: "u1", nome: "Maria da Silva", email: "maria@exemplo.com",
  telefone: "51987654321", data_nascimento: "1990-05-20", cpf: "52998224725",
  endereco: "Rua X, 10", status: "ativo", observacoes: null, aceita_lembretes: true,
  created_at: "2026-01-10T12:00:00Z", updated_at: "2026-01-10T12:00:00Z", deleted_at: null,
};

function evolucao(i: number, texto: string): Evolucao {
  return {
    id: `e${i}`, psicologa_id: "u1", paciente_id: "p1", consulta_id: null,
    data_sessao: "2026-03-09", demanda: texto, procedimentos: "Psicoeducação",
    resultados: "Mais calma", encaminhamentos: "Retorno semanal", notas_privadas: "Nota privada",
    created_at: "2026-03-09T13:00:00Z", updated_at: "2026-03-09T13:00:00Z",
    deleted_at: null, deleted_motivo: null,
  };
}

async function fonte() {
  return (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
}

describe("textoSeguro", () => {
  it("mantém acentos do português e troca o que a fonte não desenha", async () => {
    const f = await fonte();
    expect(textoSeguro("ação, coração — “ótimo”", f)).toBe("ação, coração — “ótimo”");
    expect(textoSeguro("melhora → alta ≥ 3", f)).toBe("melhora -> alta >= 3");
    expect(textoSeguro("feliz 😀", f)).toBe("feliz ?");
    expect(textoSeguro("a\tb\r\nc", f)).toBe("a    b\nc");
  });
});

describe("quebrarLinhas", () => {
  it("nenhuma linha passa da largura, e respeita quebras do texto", async () => {
    const f = await fonte();
    const texto = "palavra ".repeat(80) + "\nsegundo parágrafo " + "x".repeat(300);
    const linhas = quebrarLinhas(texto, f, 10, 200);
    expect(linhas.length).toBeGreaterThan(5);
    for (const l of linhas) expect(f.widthOfTextAtSize(l, 10)).toBeLessThanOrEqual(200);
    expect(linhas.some((l) => l.startsWith("segundo parágrafo"))).toBe(true);
  });
});

describe("gerarProntuarioPdf", () => {
  it("gera um PDF válido, mesmo com emoji e setas no texto clínico", async () => {
    const bytes = await gerarProntuarioPdf({
      psicologa: { nome: "Ana Psicóloga", crp: "07/12345" },
      paciente,
      anamnese: null,
      evolucoes: [evolucao(1, "Relatou insônia 😞 → melhora")],
    });
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Prontuário psicológico");
  });

  it("pagina quando há muitas evoluções longas", async () => {
    const longas = Array.from({ length: 30 }, (_, i) => evolucao(i, "Texto longo da sessão. ".repeat(40)));
    const doc = await PDFDocument.load(
      await gerarProntuarioPdf({ psicologa: { nome: "Ana", crp: null }, paciente, anamnese: null, evolucoes: longas }),
    );
    expect(doc.getPageCount()).toBeGreaterThan(5);
  });
});
