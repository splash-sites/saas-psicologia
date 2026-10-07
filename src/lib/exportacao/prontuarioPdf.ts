import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { PACIENTE_STATUS_LABEL, type Anamnese, type Paciente } from "@/lib/pacientes/types";
import { CAMPOS_EVOLUCAO, type Evolucao } from "@/lib/prontuario/types";
import { formatarCpf, formatarTelefoneBR } from "@/lib/pacientes/formatacao";
import { dataBRCompleta, dataHoraBR } from "./datas";

// Prontuário do paciente em PDF (download direto). Lógica pura: recebe os
// dados já lidos do banco e devolve os bytes do arquivo — testável sem
// servidor. Inclui as notas privadas (decisão do produto).
//
// Fonte padrão Helvetica (WinAnsi): cobre todos os acentos do português, sem
// embutir arquivo de fonte. Caractere fora dela (emoji, setas) é trocado por um
// equivalente ou "?" em vez de quebrar a geração.

export type DadosProntuario = {
  psicologa: { nome: string | null; crp: string | null };
  paciente: Paciente;
  anamnese: Anamnese | null;
  evolucoes: Evolucao[];
  emitidoEm?: Date;
};

const A4: [number, number] = [595.28, 841.89];
const MARGEM = 56;
const RODAPE = 40;
const LARGURA = A4[0] - MARGEM * 2;
const CINZA = rgb(0.39, 0.45, 0.55);
const PRETO = rgb(0.06, 0.09, 0.16);
const LINHA = rgb(0.8, 0.84, 0.88);

const SUBSTITUTOS: Record<string, string> = {
  "→": "->", "←": "<-", "⇒": "=>", "≥": ">=", "≤": "<=", "≠": "!=", "✓": "v", "✔": "v",
  " ": " ", "​": "",
};

/** Deixa o texto desenhável na fonte padrão (WinAnsi). */
export function textoSeguro(texto: string, fonte: PDFFont): string {
  const cache = new Map<string, string>();
  const seguro = (c: string): string => {
    if (cache.has(c)) return cache.get(c)!;
    let r = SUBSTITUTOS[c];
    if (r === undefined) {
      try {
        fonte.encodeText(c);
        r = c;
      } catch {
        // Tenta a letra base (ex: "ő" -> "o"); senão "?".
        const base = c.normalize("NFD").replace(/[̀-ͯ]/g, "");
        try {
          fonte.encodeText(base);
          r = base || "?";
        } catch {
          r = "?";
        }
      }
    }
    cache.set(c, r);
    return r;
  };
  return Array.from(texto.normalize("NFC").replace(/\t/g, "    ").replace(/\r\n?/g, "\n"))
    .map((c) => (c === "\n" ? c : seguro(c)))
    .join("");
}

/** Quebra o texto em linhas que cabem na largura (respeita \n do texto). */
export function quebrarLinhas(texto: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
  const cabe = (s: string) => fonte.widthOfTextAtSize(s, tamanho) <= largura;
  const linhas: string[] = [];
  for (const paragrafo of texto.split("\n")) {
    let atual = "";
    for (const palavra of paragrafo.split(/ +/)) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (cabe(tentativa)) {
        atual = tentativa;
        continue;
      }
      if (atual) linhas.push(atual);
      // Palavra maior que a linha (ex: link longo): corta em pedaços.
      let resto = palavra;
      while (!cabe(resto)) {
        let n = resto.length - 1;
        while (n > 1 && !cabe(resto.slice(0, n))) n--;
        linhas.push(resto.slice(0, n));
        resto = resto.slice(n);
      }
      atual = resto;
    }
    linhas.push(atual);
  }
  return linhas;
}

export async function gerarProntuarioPdf(d: DadosProntuario): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Prontuário psicológico");
  pdf.setCreator("Gestão para Psicólogos");
  pdf.setProducer("Gestão para Psicólogos");
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);

  let pagina: PDFPage = pdf.addPage(A4);
  let y = A4[1] - MARGEM;

  const novaPagina = () => {
    pagina = pdf.addPage(A4);
    y = A4[1] - MARGEM;
  };
  const garantirEspaco = (altura: number) => {
    if (y - altura < MARGEM + RODAPE) novaPagina();
  };
  const escrever = (texto: string, opcoes: { fonte?: PDFFont; tamanho?: number; cor?: typeof PRETO; antes?: number } = {}) => {
    const fonte = opcoes.fonte ?? normal;
    const tamanho = opcoes.tamanho ?? 10;
    const altura = tamanho * 1.4;
    y -= opcoes.antes ?? 0;
    for (const linha of quebrarLinhas(textoSeguro(texto, fonte), fonte, tamanho, LARGURA)) {
      garantirEspaco(altura);
      y -= altura;
      pagina.drawText(linha, { x: MARGEM, y, size: tamanho, font: fonte, color: opcoes.cor ?? PRETO });
    }
  };
  const separador = (antes = 8) => {
    garantirEspaco(antes + 4);
    y -= antes;
    pagina.drawLine({ start: { x: MARGEM, y }, end: { x: A4[0] - MARGEM, y }, thickness: 0.6, color: LINHA });
    y -= 4;
  };
  const titulo = (texto: string) => {
    // Título nunca fica sozinho no pé da página.
    garantirEspaco(60);
    escrever(texto, { fonte: negrito, tamanho: 12, antes: 14 });
    y -= 2;
  };
  const campo = (rotulo: string, valor: string | null | undefined) => {
    garantirEspaco(30);
    escrever(rotulo.toUpperCase(), { tamanho: 7.5, cor: CINZA, antes: 6 });
    escrever(valor?.trim() ? valor : "—");
  };

  const { paciente: p, psicologa, anamnese, evolucoes } = d;

  // Cabeçalho
  escrever("Prontuário psicológico", { fonte: negrito, tamanho: 16 });
  escrever(`${psicologa.nome ?? ""}${psicologa.crp ? ` · CRP ${psicologa.crp}` : ""}`, { cor: CINZA, antes: 2 });
  separador();

  titulo("Identificação");
  campo("Nome", p.nome);
  campo("Situação", PACIENTE_STATUS_LABEL[p.status]);
  campo("Data de nascimento", dataBRCompleta(p.data_nascimento));
  campo("CPF", p.cpf ? formatarCpf(p.cpf) : null);
  campo("Telefone", p.telefone ? formatarTelefoneBR(p.telefone) : null);
  campo("E-mail", p.email);
  campo("Endereço", p.endereco);
  campo("Início do acompanhamento", dataBRCompleta(p.created_at));

  titulo("Avaliação inicial (anamnese)");
  campo("Demanda / queixa inicial", anamnese?.demanda);
  campo("Objetivos do trabalho", anamnese?.objetivos);
  campo("Histórico relevante", anamnese?.historico);

  titulo(`Evoluções (${evolucoes.length})`);
  if (evolucoes.length === 0) escrever("Nenhuma evolução registrada.", { cor: CINZA });
  for (const e of evolucoes) {
    // Linha + título da sessão + início do texto sempre na mesma página.
    garantirEspaco(110);
    separador(10);
    escrever(`Sessão de ${dataBRCompleta(e.data_sessao)}`, { fonte: negrito, tamanho: 11, antes: 4 });
    for (const c of CAMPOS_EVOLUCAO) campo(c.rotulo, e[c.nome]);
    if (e.notas_privadas) campo("Notas privadas", e.notas_privadas);
    escrever(
      `Registrada em ${dataHoraBR(e.created_at)}${e.updated_at !== e.created_at ? ` · última edição em ${dataHoraBR(e.updated_at)}` : ""}`,
      { tamanho: 8, cor: CINZA, antes: 6 },
    );
  }

  // Rodapé em todas as páginas, com a numeração final.
  const emitido = dataHoraBR((d.emitidoEm ?? new Date()).toISOString());
  const paginas = pdf.getPages();
  paginas.forEach((pg, i) => {
    const texto = textoSeguro(
      `Documento sigiloso — dados de saúde (LGPD). Guarda mínima de 5 anos (Resolução CFP 01/2009). Emitido em ${emitido}.`,
      normal,
    );
    pg.drawText(texto, { x: MARGEM, y: MARGEM - 18, size: 7, font: normal, color: CINZA, maxWidth: LARGURA - 60 });
    const num = `Página ${i + 1} de ${paginas.length}`;
    pg.drawText(num, {
      x: A4[0] - MARGEM - normal.widthOfTextAtSize(num, 7),
      y: MARGEM - 18,
      size: 7,
      font: normal,
      color: CINZA,
    });
  });

  return pdf.save();
}
