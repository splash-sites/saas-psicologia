// Geração de CSV para a exportação da conta — lógica pura, testável sem banco.
//
// Formato pensado para abrir direto no Excel em português: separador ";"
// (o Excel pt-BR usa vírgula como decimal) e BOM UTF-8 (sem ele, acentos
// viram lixo). Quebras de linha são CRLF, como o RFC 4180 pede.

export type Coluna<T> = {
  titulo: string;
  valor: (linha: T) => string | number | boolean | null | undefined;
};

const BOM = "﻿";

// Célula que começa com = + - @ (ou tab/CR) é interpretada como fórmula pelo
// Excel/Sheets — um nome de paciente "=HYPERLINK(...)" viraria link ativo na
// planilha (CSV injection). Prefixar com ' faz a planilha tratar como texto.
function neutralizarFormula(texto: string): string {
  return /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
}

export function celula(valor: string | number | boolean | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "boolean") return valor ? "sim" : "não";
  // Decimal com vírgula, como o Excel pt-BR espera.
  if (typeof valor === "number") return String(valor).replace(".", ",");
  const texto = neutralizarFormula(valor);
  return /[";\r\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

export function gerarCsv<T>(colunas: Coluna<T>[], linhas: T[]): string {
  const cabecalho = colunas.map((c) => celula(c.titulo)).join(";");
  const corpo = linhas.map((l) => colunas.map((c) => celula(c.valor(l))).join(";"));
  return BOM + [cabecalho, ...corpo].join("\r\n") + "\r\n";
}
