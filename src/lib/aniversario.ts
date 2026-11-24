// Aniversário do paciente (item H, 2026-11-24). Puro: usado na agenda, no
// Painel, no painel da consulta e na prévia da mensagem em Configurações.
// Entram todos os pacientes com data de nascimento, menos os arquivados
// (decisão do usuário). Nascido em 29/02: em ano não bissexto, 28/02.

import { primeiroNome } from "@/lib/lembretes/template";

export const MENSAGEM_ANIVERSARIO_PADRAO =
  "Olá, {nome}! Feliz aniversário! Desejo um novo ano cheio de coisas boas.";

export type PacienteNascimento = {
  id: string;
  nome: string;
  data_nascimento: string | null;
  telefone?: string | null;
};

export type Aniversariante = PacienteNascimento & { data: string; idade: number };

const bissexto = (ano: number) => (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;

/** Data (AAAA-MM-DD) do aniversário no ano dado. */
export function aniversarioNoAno(nascimento: string, ano: number): string {
  let md = nascimento.slice(5, 10);
  if (md === "02-29" && !bissexto(ano)) md = "02-28";
  return `${ano}-${md}`;
}

/** Faz aniversário nesse dia (AAAA-MM-DD)? Idade que completa, ou null. */
export function idadeNoAniversario(nascimento: string | null, dia: string): number | null {
  if (!nascimento || !/^\d{4}-\d{2}-\d{2}/.test(nascimento)) return null;
  const ano = Number(dia.slice(0, 4));
  if (aniversarioNoAno(nascimento, ano) !== dia) return null;
  const idade = ano - Number(nascimento.slice(0, 4));
  return idade > 0 ? idade : null;
}

/** Aniversariantes de cada dia pedido (dias sem ninguém ficam de fora). */
export function aniversariantesPorDia<P extends PacienteNascimento>(
  pacientes: P[],
  dias: string[],
): Map<string, (P & { data: string; idade: number })[]> {
  const r = new Map<string, (P & { data: string; idade: number })[]>();
  for (const dia of dias) {
    const lista = pacientes
      .map((p) => ({ ...p, data: dia, idade: idadeNoAniversario(p.data_nascimento, dia) }))
      .filter((p): p is P & { data: string; idade: number } => p.idade !== null)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    if (lista.length) r.set(dia, lista);
  }
  return r;
}

/** Mensagem de parabéns com o primeiro nome (vazio = padrão). */
export function mensagemAniversario(template: string | null | undefined, nome: string): string {
  const base = template && template.trim() !== "" ? template : MENSAGEM_ANIVERSARIO_PADRAO;
  return base
    .replace(/\{nome\}/g, primeiroNome(nome))
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
