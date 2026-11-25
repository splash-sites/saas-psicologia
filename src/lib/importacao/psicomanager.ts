import { validarCpfCnpj } from "@/lib/assinatura/cpfCnpj";
import { LIMITES } from "@/lib/limites";

// Importação do PsicoManager (decisões do usuário em 2026-11-25; ver CLAUDE.md,
// "Feature nova: importar dados do PsicoManager"). Lógica pura: recebe as
// linhas das duas planilhas (aba "Relatório", cabeçalho na 1ª linha, "-" =
// vazio) e devolve o que vai para o banco. Roda no navegador (prévia) e é
// testada com planilha falsa — nunca com a real.

export const ORIGEM = "psicomanager";
export const DURACAO_MIN = 50;

export const COLUNAS_PACIENTES = ["Nome Completo", "CPF", "E-mail", "Data de Nascimento", "Tel. Celular"] as const;
export const COLUNAS_SESSOES = ["Nome do Cliente", "Data", "Hora", "Presença", "Status do Pagamento", "Valor a Receber"] as const;

export type Linha = Record<string, unknown>;

export type PacienteImport = {
  /** Nome normalizado: liga as sessões ao paciente e vira o origem_id. */
  chave: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  data_nascimento: string | null;
  telefone: string | null;
  endereco: string | null;
  observacoes: string | null;
  /** Valor da última sessão com valor (preenchido por `importarPlanilhas`). */
  valor_sessao: number | null;
};

export type StatusSessao = "realizada" | "falta" | "cancelada" | "agendada";

export type PagamentoImport = {
  status: "pago" | "pendente";
  valor: number;
  data_pagamento: string | null;
  forma_pagamento: "pix" | "boleto" | "dinheiro" | "transferencia" | null;
};

export type SessaoImport = {
  /** paciente + data + hora: não duplica ao importar de novo. */
  origemId: string;
  chave: string;
  inicio: string;
  fim: string;
  status: StatusSessao;
  futura: boolean;
  /** Texto da evolução ("Avaliação da demanda / objetivos"). */
  demanda: string | null;
  /** "Anotaçoes de Antes da Sessao" → Anotações para a sessão. */
  anotacoesSessao: string | null;
  /** Valor da consulta: só nas futuras (o lançamento nasce depois da sessão). */
  valorConsulta: number | null;
  pagamento: PagamentoImport | null;
};

export type ResultadoLeitura = {
  pacientes: PacienteImport[];
  sessoes: SessaoImport[];
  /** Sessões cujo paciente não está na planilha de cadastro. */
  semCadastro: string[];
  /** Linhas ignoradas (data/hora ilegível). */
  ignoradas: number;
};

// ---------------------------------------------------------------- utilitários

const vazio = (v: unknown) => v == null || String(v).trim() === "" || String(v).trim() === "-";
const texto = (v: unknown): string | null => (vazio(v) ? null : String(v).replace(/\s+/g, " ").trim());

export function normalizarNome(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const digitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/** "dd/mm/aaaa" (ou Date) → "aaaa-mm-dd"; null se não for data de verdade. */
export function dataISO(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v ?? "").trim());
  if (!m) return null;
  const [d, mes, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(a, mes - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== mes - 1 || dt.getUTCDate() !== d) return null;
  return `${a}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "120,00" / "1.234,56" → número; null se vazio ou ilegível. */
export function valorBR(v: unknown): number | null {
  if (vazio(v)) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const hhmm = (v: unknown): string | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(v ?? "").trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
};

const corta = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

// ------------------------------------------------------------------ pacientes

/** Telefone: com DDD (10–11 dígitos, DDI 55 tirado) vai para o cadastro; sem DDD, para as observações. */
export function telefoneComDDD(v: unknown): { telefone: string | null; semDDD: string | null } {
  if (vazio(v)) return { telefone: null, semDDD: null };
  let d = digitos(v);
  if (/^55\d{10,11}$/.test(d)) d = d.slice(2);
  if (/^0\d{10,11}$/.test(d)) d = d.slice(1);
  if (/^\d{10,11}$/.test(d)) return { telefone: d, semDDD: null };
  return { telefone: null, semDDD: String(v).trim() };
}

export function lerPaciente(l: Linha, hoje: string): PacienteImport | null {
  const nome = texto(l["Nome Completo"]);
  if (!nome) return null;

  const cpfDig = digitos(l["CPF"]);
  const cpf = cpfDig.length === 11 && validarCpfCnpj(cpfDig).tipo === "cpf" ? cpfDig : null;

  const emailTxt = texto(l["E-mail"])?.toLowerCase() ?? null;
  const email = emailTxt && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailTxt) && emailTxt.length <= LIMITES.paciente.email ? emailTxt : null;

  const nasc = dataISO(l["Data de Nascimento"]);
  const data_nascimento = nasc && nasc >= "1900-01-01" && nasc <= hoje ? nasc : null;

  const cel = telefoneComDDD(l["Tel. Celular"]);

  const cidadeUf = [texto(l["Cidade"]), texto(l["Estado"])].filter(Boolean).join("/");
  const partesEndereco = [texto(l["Endereço"]), texto(l["Número"]), texto(l["Complemento"]), texto(l["Bairro"]), cidadeUf || null, texto(l["CEP"])]
    .filter((x): x is string => Boolean(x));
  const endereco = partesEndereco.length ? corta(partesEndereco.join(", "), LIMITES.paciente.endereco) : null;

  // O que não tem campo próprio no Gradatim vai para as observações.
  const obs = [
    texto(l["Nome de Parente"]) && `Parente: ${texto(l["Nome de Parente"])}`,
    texto(l["Nome do Responsável"]) && `Responsável: ${texto(l["Nome do Responsável"])}`,
    texto(l["Sexo"]) && `Sexo: ${texto(l["Sexo"])}`,
    texto(l["Profissão"]) && `Profissão: ${texto(l["Profissão"])}`,
    texto(l["Tel. Fixo"]) && `Telefone fixo: ${texto(l["Tel. Fixo"])}`,
    cel.semDDD && `Telefone sem DDD: ${cel.semDDD}`,
    !vazio(l["Obs"]) && `Obs.: ${String(l["Obs"]).trim()}`,
  ].filter((x): x is string => Boolean(x));

  return {
    chave: normalizarNome(nome),
    nome: corta(nome, LIMITES.paciente.nome),
    cpf,
    email,
    data_nascimento,
    telefone: cel.telefone,
    endereco,
    observacoes: obs.length ? corta(obs.join("\n"), LIMITES.paciente.observacoes) : null,
    valor_sessao: null,
  };
}

// ------------------------------------------------------------------- anotação

const ROTULOS =
  /(Resumo da Sess[aã]o|Anota[cç][oõ]es de Antes da Sess[aã]o|Ficha de evolu[cç][aã]o|Queixa do Cliente|Observa[cç][aã]o|Anota[cç][oõ]es|Resumo)\s*:/gi;
const ANTES = /^anota[cç][oõ]es de antes da sess[aã]o$/i;
const RESUMO = /^resumo( da sess[aã]o)?$/i;

/**
 * Separa a anotação do PsicoManager: "Anotaçoes de Antes da Sessao" vai para
 * as anotações para a sessão; o resto é a evolução, sem o "Resumo da Sessao:"
 * do começo e com os outros rótulos começando linha nova.
 */
export function separarAnotacao(v: unknown): { demanda: string | null; antes: string | null } {
  if (vazio(v)) return { demanda: null, antes: null };
  const s = String(v).trim();
  const partes: { rotulo: string | null; texto: string }[] = [];
  let ultimo = 0;
  let rotulo: string | null = null;
  for (const m of s.matchAll(ROTULOS)) {
    partes.push({ rotulo, texto: s.slice(ultimo, m.index) });
    rotulo = m[1];
    ultimo = m.index! + m[0].length;
  }
  partes.push({ rotulo, texto: s.slice(ultimo) });

  const antes: string[] = [];
  const evolucao: string[] = [];
  for (const p of partes) {
    const t = p.texto.trim();
    if (!t && !p.rotulo) continue;
    if (p.rotulo && ANTES.test(p.rotulo)) {
      if (t) antes.push(t);
    } else if (!p.rotulo || (RESUMO.test(p.rotulo) && evolucao.length === 0)) {
      if (t) evolucao.push(t);
    } else if (t) {
      evolucao.push(`${p.rotulo}: ${t}`);
    }
  }
  const limite = (x: string[]) => (x.length ? corta(x.join("\n"), LIMITES.textoClinico) : null);
  return { demanda: limite(evolucao), antes: limite(antes) };
}

// -------------------------------------------------------------------- sessões

function statusDaPresenca(v: unknown, futura: boolean): StatusSessao {
  const p = normalizarNome(String(v ?? ""));
  if (p.includes("cancel")) return "cancelada";
  if (p.includes("ausen") || p.includes("falt")) return "falta";
  if (p.includes("presen")) return "realizada";
  return futura ? "agendada" : "realizada";
}

function formaPagamento(v: unknown): PagamentoImport["forma_pagamento"] {
  const f = normalizarNome(String(v ?? ""));
  if (f.includes("pix")) return "pix";
  if (f.includes("boleto")) return "boleto";
  if (f.includes("dinheiro")) return "dinheiro";
  if (f.includes("transfer")) return "transferencia";
  return null;
}

export function lerSessao(l: Linha, agora: Date): SessaoImport | null {
  const nome = texto(l["Nome do Cliente"]);
  const data = dataISO(l["Data"]);
  const hora = hhmm(l["Hora"]);
  if (!nome || !data || !hora) return null;

  const inicioDt = new Date(`${data}T${hora}:00-03:00`);
  const fimDt = new Date(inicioDt.getTime() + DURACAO_MIN * 60_000);
  const futura = inicioDt.getTime() > agora.getTime();
  const status = statusDaPresenca(l["Presença"], futura);
  const { demanda, antes } = separarAnotacao(l["Anotações"]);

  const valor = valorBR(l["Valor a Receber"]);
  const cobra = valor != null && valor > 0 && valor <= LIMITES.pagamento.valorMax;
  const pagto = normalizarNome(String(l["Status do Pagamento"] ?? ""));

  // Pago: lançamento pago com o valor da sessão (o "valor pago" junta várias
  // sessões numa linha só). Não pago e realizada no passado: pendente.
  // Isento ou valor 0: sem lançamento.
  let pagamento: PagamentoImport | null = null;
  if (cobra && pagto === "pago") {
    pagamento = {
      status: "pago",
      valor: valor!,
      data_pagamento: dataISO(l["Data de Pagamento"]) ?? data,
      forma_pagamento: formaPagamento(l["Forma de Pagamento"]),
    };
  } else if (cobra && pagto.startsWith("nao pago") && !futura && status === "realizada") {
    pagamento = { status: "pendente", valor: valor!, data_pagamento: null, forma_pagamento: null };
  }

  return {
    origemId: `${normalizarNome(nome)}|${data}|${hora}`,
    chave: normalizarNome(nome),
    inicio: inicioDt.toISOString(),
    fim: fimDt.toISOString(),
    status,
    futura,
    demanda,
    anotacoesSessao: antes,
    // Futura com valor: o lançamento "a receber" nasce sozinho depois da sessão
    // (0035). Passada: o valor vai só no lançamento importado.
    valorConsulta: futura && cobra && pagto !== "isento" && !pagamento ? valor : null,
    pagamento,
  };
}

// --------------------------------------------------------------------- tudo

/** Qual planilha é qual, pelo cabeçalho. */
export function tipoDaPlanilha(cabecalho: string[]): "pacientes" | "sessoes" | null {
  const tem = (cols: readonly string[]) => cols.every((c) => cabecalho.includes(c));
  if (tem(COLUNAS_SESSOES)) return "sessoes";
  if (tem(COLUNAS_PACIENTES)) return "pacientes";
  return null;
}

export function importarPlanilhas(linhasPacientes: Linha[], linhasSessoes: Linha[], agora: Date = new Date()): ResultadoLeitura {
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
  const pacientes = new Map<string, PacienteImport>();
  for (const l of linhasPacientes) {
    const p = lerPaciente(l, hoje);
    if (p && !pacientes.has(p.chave)) pacientes.set(p.chave, p);
  }

  const sessoes: SessaoImport[] = [];
  const vistas = new Set<string>();
  const semCadastro = new Set<string>();
  let ignoradas = 0;
  for (const l of linhasSessoes) {
    const s = lerSessao(l, agora);
    if (!s) {
      ignoradas++;
      continue;
    }
    if (!pacientes.has(s.chave)) {
      semCadastro.add(texto(l["Nome do Cliente"]) ?? s.chave);
      continue;
    }
    if (vistas.has(s.origemId)) continue;
    vistas.add(s.origemId);
    sessoes.push(s);
  }
  sessoes.sort((a, b) => a.inicio.localeCompare(b.inicio));

  // Valor da sessão do paciente = o da última sessão com valor.
  for (const s of sessoes) {
    const v = s.pagamento?.valor ?? s.valorConsulta;
    if (v != null) pacientes.get(s.chave)!.valor_sessao = v;
  }

  return { pacientes: [...pacientes.values()], sessoes, semCadastro: [...semCadastro], ignoradas };
}

/**
 * Sessões da própria planilha que se sobrepõem (não canceladas): fica a
 * primeira; as outras voltam aqui (o banco não aceita duas no mesmo horário).
 */
export function sobrepostasNaPlanilha(sessoes: SessaoImport[]): Set<string> {
  const ativas = sessoes.filter((s) => s.status !== "cancelada").sort((a, b) => a.inicio.localeCompare(b.inicio));
  const fora = new Set<string>();
  let fimAtual = "";
  for (const s of ativas) {
    if (fimAtual && s.inicio < fimAtual) fora.add(s.origemId);
    else fimAtual = s.fim;
  }
  return fora;
}
