"use server";

import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { addDias, brWallTimeToDate, dataChaveBR, dataUtil, diasDaSemana, segundaDaSemana } from "@/lib/agenda/datas";
import { minutosNoDiaBR } from "@/lib/agenda/grade";
import { diasDoBloqueio } from "@/lib/agenda/bloqueios";
import { feriadosDaPsicologa, rotuloFeriado } from "@/lib/feriados";

// Prévia da semana no formulário de consulta (2026-11-24, decisões do usuário):
// o que já ocupa a semana da data escolhida — consultas (com o nome do
// paciente; o modo privado borra), eventos e feriados. Só leitura, pelo RLS.

export type ItemPrevia = {
  id: string;
  dia: string;
  ini: number; // minutos no dia (Brasília)
  fim: number;
  rotulo: string;
  tipo: "consulta" | "evento";
};

export type SemanaPrevia = {
  segunda: string;
  dias: string[];
  itens: ItemPrevia[];
  /** Dia → "Feriado: Natal" / evento de dia inteiro. */
  faixas: Record<string, string[]>;
};

const um = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export async function semanaParaPrevia(data: string, ignorarConsultaId?: string): Promise<SemanaPrevia | null> {
  const user = await usuarioAtual();
  if (!user || !dataUtil(data)) return null;
  const supabase = await createClient();

  const segunda = segundaDaSemana(brWallTimeToDate(data, "12:00"));
  const semana = diasDaSemana(segunda);
  const de = brWallTimeToDate(segunda, "00:00").toISOString();
  const ate = brWallTimeToDate(addDias(segunda, 7), "00:00").toISOString();

  const [{ data: consultas }, { data: bloqueios }, { data: pref }] = await Promise.all([
    supabase
      .from("consultas")
      .select("id, inicio, fim, pacientes(nome)")
      .is("deleted_at", null)
      .neq("status", "cancelada")
      .gte("inicio", de)
      .lt("inicio", ate)
      .order("inicio")
      .limit(500),
    supabase.from("bloqueios").select("id, inicio, fim, motivo, dia_inteiro").lt("inicio", ate).gt("fim", de).limit(500),
    supabase.from("psicologas").select("feriados_uf, mostrar_feriados").eq("id", user.id).maybeSingle(),
  ]);

  const itens: ItemPrevia[] = [];
  const faixas: Record<string, string[]> = {};
  const faixa = (dia: string, texto: string) => (faixas[dia] ??= []).push(texto);

  for (const c of consultas ?? []) {
    if (c.id === ignorarConsultaId) continue;
    const ini = minutosNoDiaBR(c.inicio as string);
    const fim = minutosNoDiaBR(c.fim as string);
    itens.push({
      id: c.id as string,
      dia: dataChaveBR(c.inicio as string),
      ini,
      fim: fim > ini ? fim : 24 * 60,
      rotulo: (um(c.pacientes as { nome: string } | { nome: string }[] | null)?.nome ?? "Consulta").split(" ")[0],
      tipo: "consulta",
    });
  }
  for (const b of bloqueios ?? []) {
    const motivo = (b.motivo as string | null) || "Evento";
    if (b.dia_inteiro) {
      for (const d of diasDoBloqueio(b as { inicio: string; fim: string })) if (semana.includes(d)) faixa(d, motivo);
      continue;
    }
    const ini = minutosNoDiaBR(b.inicio as string);
    const fim = minutosNoDiaBR(b.fim as string);
    itens.push({ id: b.id as string, dia: dataChaveBR(b.inicio as string), ini, fim: fim > ini ? fim : 24 * 60, rotulo: motivo, tipo: "evento" });
  }
  for (const [d, f] of feriadosDaPsicologa(semana, pref)) faixa(d, rotuloFeriado(f));

  // Domingo só aparece se houver algo nele.
  const domingo = semana[6];
  const temDomingo = itens.some((i) => i.dia === domingo) || Boolean(faixas[domingo]);
  return { segunda, dias: temDomingo ? semana : semana.slice(0, 6), itens, faixas };
}
