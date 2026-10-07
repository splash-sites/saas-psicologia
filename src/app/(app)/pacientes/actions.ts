"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { mensagemErroEscrita } from "@/lib/assinatura/guard";
import { pacientePertenceAPsicologa } from "@/lib/pacientes/dono";
import {
  pacienteSchema,
  anamneseSchema,
  toNullable,
} from "@/lib/pacientes/schema";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

async function requirePsicologa() {
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function criarPaciente(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requirePsicologa();

  const parsed = pacienteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { data, error } = await supabase
    .from("pacientes")
    .insert({ ...toNullable(parsed.data), psicologa_id: user.id })
    .select("id")
    .single();

  if (error) return { error: await mensagemErroEscrita(supabase, error, "Não foi possível salvar o paciente.") };

  revalidatePath("/pacientes");
  redirect(`/pacientes/${data.id}`);
}

export async function atualizarPaciente(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requirePsicologa();

  const parsed = pacienteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // O RLS não dá erro em update de linha alheia/arquivada: só não afeta nada.
  const { data: alterados, error } = await supabase
    .from("pacientes")
    .update(toNullable(parsed.data))
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");

  if (error) return { error: await mensagemErroEscrita(supabase, error, "Não foi possível atualizar o paciente.") };
  if (!alterados?.length) return { error: "Paciente não encontrado." };

  revalidatePath("/pacientes");
  revalidatePath(`/pacientes/${id}`);
  redirect(`/pacientes/${id}`);
}

export async function excluirPaciente(
  id: string,
  _formData: FormData,
): Promise<void> {
  const { supabase } = await requirePsicologa();

  // Soft delete: registro clínico nunca é apagado fisicamente.
  await supabase
    .from("pacientes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null);

  revalidatePath("/pacientes");
  redirect("/pacientes");
}

export async function salvarAnamnese(
  pacienteId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requirePsicologa();

  const parsed = anamneseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!(await pacientePertenceAPsicologa(supabase, pacienteId))) {
    return { error: "Paciente inválido." };
  }

  // upsert pela unicidade de paciente_id (1 ficha por paciente).
  const { error } = await supabase.from("anamneses").upsert(
    {
      ...toNullable(parsed.data),
      paciente_id: pacienteId,
      psicologa_id: user.id,
    },
    { onConflict: "paciente_id" },
  );

  if (error) return { error: await mensagemErroEscrita(supabase, error, "Não foi possível salvar a anamnese.") };

  revalidatePath(`/pacientes/${pacienteId}`);
  return {};
}
