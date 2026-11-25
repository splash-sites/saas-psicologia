"use server";

import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { addDias, brWallTimeToDate, dataChaveBR, dataUtil, diasDaSemana, segundaDaSemana } from "@/lib/agenda/datas";
import { minutosNoDiaBR } from "@/lib/agenda/grade";
import { diasDoBloqueio } from "@/lib/agenda/bloqueios";
import { feriadosDaPsicologa, rotuloFeriado } from "@/lib/feriados";
import { aniversariantesPorDia, type PacienteNascimento } from "@/lib/aniversario";
import { horarioDaConta, type HorarioDia } from "@/lib/agenda/horarioAtendimento";

// Prévia de horários livres no formulário de consulta (2026-11-25, canvas
// "Livres"): o que ocupa a semana da data escolhida — consultas não
// canceladas (com o primeiro nome do paciente; o modo privado borra) e
// eventos —, o horário de atendimento (0044), feriados e aniversários.
// Só leitura, pelo RLS. Os horários livres são calculados no navegador
// (mudam com a duração do formulário).

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
  /** Os 7 dias, segunda a domingo. */
  dias: string[];
  itens: ItemPrevia[];
  /** Horário de atendimento, um por dia da semana (0 = domingo). */
  horario: HorarioDia[];
  /** Dias tomados por evento de dia inteiro (férias): nenhum horário livre. */
  diasBloqueados: Record<string, string>;
  /** Dia → "Feriado: Natal". */
  feriados: Record<string, string>;
  /** Dia → primeiros nomes dos aniversariantes. */
  aniversarios: Record<string, string[]>;
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

  const [{ data: consultas }, { data: bloqueios }, { data: pref }, { data: horarioRaw }, { data: nascimentos }] =
    await Promise.all([
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
      // Sem a migration 0044, dá erro e vale o horário padrão.
      supabase.from("horarios_atendimento").select("dia_semana, ativo, inicio, fim"),
      supabase
        .from("pacientes")
        .select("id, nome, data_nascimento, telefone")
        .is("deleted_at", null)
        .not("data_nascimento", "is", null)
        .limit(1000),
    ]);

  const itens: ItemPrevia[] = [];
  const diasBloqueados: Record<string, string> = {};
  const feriados: Record<string, string> = {};
  const aniversarios: Record<string, string[]> = {};

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
      for (const d of diasDoBloqueio(b as { inicio: string; fim: string })) if (semana.includes(d)) diasBloqueados[d] = motivo;
      continue;
    }
    const ini = minutosNoDiaBR(b.inicio as string);
    const fim = minutosNoDiaBR(b.fim as string);
    itens.push({ id: b.id as string, dia: dataChaveBR(b.inicio as string), ini, fim: fim > ini ? fim : 24 * 60, rotulo: motivo, tipo: "evento" });
  }
  for (const [d, f] of feriadosDaPsicologa(semana, pref)) feriados[d] = rotuloFeriado(f);
  for (const [d, lista] of aniversariantesPorDia((nascimentos ?? []) as PacienteNascimento[], semana)) {
    aniversarios[d] = lista.map((p) => p.nome.split(" ")[0]);
  }

  return {
    segunda,
    dias: semana,
    itens,
    horario: horarioDaConta(horarioRaw as Parameters<typeof horarioDaConta>[0]),
    diasBloqueados,
    feriados,
    aniversarios,
  };
}
