"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  consultaSchema,
  consultaEdicaoSchema,
  bloqueioSchema,
} from "@/lib/agenda/schema";
import {
  brWallTimeToDate,
  gerarOcorrencias,
  horaBR,
  dataBR,
} from "@/lib/agenda/datas";
import { sobrepoe } from "@/lib/agenda/overlap";
import { sincronizarConsulta, sincronizarConsultas } from "@/lib/agenda/sync";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

async function requirePsicologa() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// Conflitos com consultas ativas ou bloqueios da psicóloga, para os slots dados.
async function slotsEmConflito(
  supabase: Awaited<ReturnType<typeof requirePsicologa>>["supabase"],
  slots: { inicio: Date; fim: Date }[],
  ignorarConsultaId?: string,
): Promise<{ inicio: Date; fim: Date }[]> {
  const min = new Date(
    Math.min(...slots.map((s) => s.inicio.getTime())),
  ).toISOString();
  const max = new Date(
    Math.max(...slots.map((s) => s.fim.getTime())),
  ).toISOString();

  const [{ data: consultas }, { data: bloqueios }] = await Promise.all([
    supabase
      .from("consultas")
      .select("id, inicio, fim")
      .neq("status", "cancelada")
      .is("deleted_at", null)
      .lt("inicio", max)
      .gt("fim", min),
    supabase
      .from("bloqueios")
      .select("inicio, fim")
      .lt("inicio", max)
      .gt("fim", min),
  ]);

  const ocupados = [
    ...(consultas ?? []).filter((c) => c.id !== ignorarConsultaId),
    ...(bloqueios ?? []),
  ];

  return slots.filter((s) =>
    ocupados.some((o) => sobrepoe(s.inicio, s.fim, o.inicio, o.fim)),
  );
}

function listaDatas(slots: { inicio: Date }[]): string {
  return slots
    .map((s) => `${dataBR(s.inicio.toISOString())} ${horaBR(s.inicio.toISOString())}`)
    .join(", ");
}

export async function criarConsulta(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requirePsicologa();

  const parsed = consultaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const v = parsed.data;

  const primeiroInicio = brWallTimeToDate(v.data, v.hora);
  if (Number.isNaN(primeiroInicio.getTime())) {
    return { fieldErrors: { hora: ["Data/hora inválida"] } };
  }

  const slots = gerarOcorrencias(
    primeiroInicio,
    v.duracao_min,
    v.recorrencia,
    v.ocorrencias,
  );

  const conflitos = await slotsEmConflito(supabase, slots);
  if (conflitos.length > 0) {
    return {
      error: `Conflito de horário em: ${listaDatas(conflitos)}. Ajuste o horário ou remova o bloqueio.`,
    };
  }

  const serieId = v.recorrencia === "nenhuma" ? null : randomUUID();
  const linhas = slots.map((s) => ({
    psicologa_id: user.id,
    paciente_id: v.paciente_id,
    inicio: s.inicio.toISOString(),
    fim: s.fim.toISOString(),
    modalidade: v.modalidade,
    recorrencia: v.recorrencia,
    serie_id: serieId,
    observacoes: v.observacoes ?? null,
  }));

  const { data: inseridas, error } = await supabase
    .from("consultas")
    .insert(linhas)
    .select("id");
  if (error) {
    if (error.code === "23P01") {
      return { error: "Conflito de horário com outra consulta. Recarregue e tente de novo." };
    }
    return { error: "Não foi possível agendar a consulta." };
  }

  // Empurra para o Google Calendar (best-effort — não bloqueia o agendamento).
  await sincronizarConsultas(
    supabase,
    user.id,
    (inseridas ?? []).map((r) => r.id),
  );

  revalidatePath("/agenda");
  redirect("/agenda");
}

export async function atualizarConsulta(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requirePsicologa();

  const parsed = consultaEdicaoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const v = parsed.data;
  const inicio = brWallTimeToDate(v.data, v.hora);
  const fim = new Date(inicio.getTime() + v.duracao_min * 60000);

  if (v.status !== "cancelada") {
    const conflitos = await slotsEmConflito(supabase, [{ inicio, fim }], id);
    if (conflitos.length > 0) {
      return { error: "Conflito de horário com outra consulta ou bloqueio." };
    }
  }

  const { error } = await supabase
    .from("consultas")
    .update({
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      modalidade: v.modalidade,
      status: v.status,
      observacoes: v.observacoes ?? null,
    })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) {
    if (error.code === "23P01") {
      return { error: "Conflito de horário com outra consulta." };
    }
    return { error: "Não foi possível atualizar a consulta." };
  }

  await sincronizarConsulta(supabase, user.id, id);

  revalidatePath("/agenda");
  revalidatePath(`/agenda/${id}`);
  redirect(`/agenda/${id}`);
}

export async function cancelarConsulta(
  id: string,
  escopo: "esta" | "serie",
  _formData: FormData,
): Promise<void> {
  const { supabase, user } = await requirePsicologa();

  let query = supabase.from("consultas").update({ status: "cancelada" });

  if (escopo === "serie") {
    const { data: alvo } = await supabase
      .from("consultas")
      .select("serie_id")
      .eq("id", id)
      .maybeSingle();
    if (alvo?.serie_id) {
      // Cancela as ocorrências futuras (>= agora) da série; mantém histórico.
      query = query
        .eq("serie_id", alvo.serie_id)
        .gte("inicio", new Date().toISOString());
    } else {
      query = query.eq("id", id);
    }
  } else {
    query = query.eq("id", id);
  }

  const { data: canceladas } = await query.select("id");

  // Remove os eventos correspondentes no Google Calendar (best-effort).
  await sincronizarConsultas(
    supabase,
    user.id,
    (canceladas ?? []).map((r) => r.id),
  );

  revalidatePath("/agenda");
  redirect("/agenda");
}

export async function sincronizarConsultaAgora(
  id: string,
  _formData: FormData,
): Promise<void> {
  const { supabase, user } = await requirePsicologa();
  await sincronizarConsulta(supabase, user.id, id);
  revalidatePath("/agenda");
  revalidatePath(`/agenda/${id}`);
  redirect(`/agenda/${id}`);
}

export async function criarBloqueio(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requirePsicologa();

  const parsed = bloqueioSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const v = parsed.data;
  const inicio = brWallTimeToDate(v.data, v.hora_inicio);
  const fim = brWallTimeToDate(v.data, v.hora_fim);

  const conflitos = await slotsEmConflito(supabase, [{ inicio, fim }]);
  if (conflitos.length > 0) {
    return {
      error:
        "Já existe consulta ou bloqueio nesse intervalo. Cancele a consulta antes de bloquear.",
    };
  }

  const { error } = await supabase.from("bloqueios").insert({
    psicologa_id: user.id,
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    motivo: v.motivo ?? null,
  });

  if (error) {
    if (error.code === "23P01") {
      return { error: "Esse intervalo já está bloqueado." };
    }
    return { error: "Não foi possível criar o bloqueio." };
  }

  revalidatePath("/agenda");
  redirect("/agenda/bloqueios");
}

export async function excluirBloqueio(
  id: string,
  _formData: FormData,
): Promise<void> {
  const { supabase } = await requirePsicologa();
  await supabase.from("bloqueios").delete().eq("id", id);
  revalidatePath("/agenda");
  redirect("/agenda/bloqueios");
}
