"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mensagemErroEscrita } from "@/lib/assinatura/guard";
import { evolucaoSchema, arquivarSchema } from "@/lib/prontuario/schema";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

async function requirePsicologaEPaciente(pacienteId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS já restringe pacientes à psicóloga dona — se não achou, não é dela.
  const { data: paciente } = await supabase
    .from("pacientes")
    .select("id")
    .eq("id", pacienteId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!paciente) redirect("/pacientes");

  return { supabase, user };
}

export async function criarEvolucao(
  pacienteId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requirePsicologaEPaciente(pacienteId);

  const parsed = evolucaoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const v = parsed.data;

  const { data, error } = await supabase
    .from("evolucoes")
    .insert({
      psicologa_id: user.id,
      paciente_id: pacienteId,
      consulta_id: v.consulta_id ?? null,
      data_sessao: v.data_sessao,
      demanda: v.demanda,
      procedimentos: v.procedimentos,
      resultados: v.resultados,
      encaminhamentos: v.encaminhamentos,
      notas_privadas: v.notas_privadas ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: await mensagemErroEscrita(supabase, error, "Não foi possível salvar a evolução.") };

  revalidatePath(`/pacientes/${pacienteId}`);
  revalidatePath(`/pacientes/${pacienteId}/evolucoes`);
  redirect(`/pacientes/${pacienteId}/evolucoes/${data.id}`);
}

export async function atualizarEvolucao(
  pacienteId: string,
  evolucaoId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requirePsicologaEPaciente(pacienteId);

  const parsed = evolucaoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const v = parsed.data;

  // O RLS não dá erro em update de linha alheia/arquivada: só não afeta nada.
  const { data: alterados, error } = await supabase
    .from("evolucoes")
    .update({
      consulta_id: v.consulta_id ?? null,
      data_sessao: v.data_sessao,
      demanda: v.demanda,
      procedimentos: v.procedimentos,
      resultados: v.resultados,
      encaminhamentos: v.encaminhamentos,
      notas_privadas: v.notas_privadas ?? null,
    })
    .eq("id", evolucaoId)
    .eq("paciente_id", pacienteId)
    .is("deleted_at", null)
    .select("id");

  if (error) return { error: await mensagemErroEscrita(supabase, error, "Não foi possível atualizar a evolução.") };
  if (!alterados?.length) return { error: "Evolução não encontrada." };

  revalidatePath(`/pacientes/${pacienteId}/evolucoes`);
  revalidatePath(`/pacientes/${pacienteId}/evolucoes/${evolucaoId}`);
  redirect(`/pacientes/${pacienteId}/evolucoes/${evolucaoId}`);
}

export async function arquivarEvolucao(
  pacienteId: string,
  evolucaoId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requirePsicologaEPaciente(pacienteId);

  const parsed = arquivarSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // Soft delete — o registro continua guardado (guarda mínima de 5 anos).
  const { error } = await supabase
    .from("evolucoes")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_motivo: parsed.data.motivo,
    })
    .eq("id", evolucaoId)
    .eq("paciente_id", pacienteId)
    .is("deleted_at", null);

  if (error) return { error: await mensagemErroEscrita(supabase, error, "Não foi possível arquivar a evolução.") };

  revalidatePath(`/pacientes/${pacienteId}/evolucoes`);
  redirect(`/pacientes/${pacienteId}/evolucoes`);
}
