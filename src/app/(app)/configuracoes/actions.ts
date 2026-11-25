"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { preferenciasLembreteSchema } from "@/lib/lembretes/schema";
import { linkAtendimentoSchema } from "@/lib/agenda/linkOnline";
import { ufValida } from "@/lib/feriados";
import { LIMITES } from "@/lib/limites";
import { lerHorarioDoFormulario } from "@/lib/agenda/horarioAtendimento";

export type FormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function desconectarGoogle(): Promise<void> {
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  // Policy de delete permite remover só a própria linha.
  await supabase
    .from("google_oauth_tokens")
    .delete()
    .eq("psicologa_id", user.id);

  // Marca as consultas futuras como fora de sincronização.
  await supabase
    .from("consultas")
    .update({ sync_status: "desativada" })
    .eq("psicologa_id", user.id)
    .neq("status", "cancelada")
    .gte("inicio", new Date().toISOString());

  revalidatePath("/configuracoes");
}

export async function salvarLinkAtendimento(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const parsed = linkAtendimentoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // Policy psicologas_update_own: só a própria linha.
  const { data, error } = await supabase
    .from("psicologas")
    .update(parsed.data)
    .eq("id", user.id)
    .select("id");

  if (error || !data?.length) return { error: "Não foi possível salvar o link." };

  revalidatePath("/configuracoes");
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  revalidatePath("/lembretes");
  return { ok: true };
}

export async function salvarPreferenciasLembrete(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const parsed = preferenciasLembreteSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { error } = await supabase.from("preferencias_lembrete").upsert(
    { psicologa_id: user.id, ...parsed.data },
    { onConflict: "psicologa_id" },
  );

  if (error) return { error: "Não foi possível salvar as preferências." };

  revalidatePath("/configuracoes");
  revalidatePath("/lembretes");
  return { ok: true };
}

/** Feriados no calendário (0038): estado e "Mostrar feriados no calendário". */
export async function salvarFeriados(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const uf = String(formData.get("feriados_uf") ?? "");
  if (uf && !ufValida(uf)) return { error: "Estado inválido." };

  // Policy psicologas_update_own: só a própria linha.
  const { data, error } = await supabase
    .from("psicologas")
    .update({ feriados_uf: uf || null, mostrar_feriados: formData.get("mostrar_feriados") === "on" })
    .eq("id", user.id)
    .select("id");

  if (error || !data?.length) return { error: "Não foi possível salvar." };

  revalidatePath("/configuracoes");
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Horário de atendimento (0044): os 7 dias de uma vez. Usado pela prévia de
 * horários livres ao marcar consulta; não impede marcar fora dele.
 */
export async function salvarHorarioAtendimento(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const { horario, erros } = lerHorarioDoFormulario((c) => {
    const v = formData.get(c);
    return typeof v === "string" ? v : null;
  });
  if (Object.keys(erros).length) return { fieldErrors: erros };

  // RLS: só as linhas da própria conta.
  const { error } = await supabase.from("horarios_atendimento").upsert(
    horario.map((h) => ({ psicologa_id: user.id, dia_semana: h.dia, ativo: h.ativo, inicio: h.inicio, fim: h.fim })),
    { onConflict: "psicologa_id,dia_semana" },
  );
  if (error) return { error: "Não foi possível salvar o horário de atendimento." };

  revalidatePath("/configuracoes");
  return { ok: true };
}

/** Mensagem de parabéns do aniversário do paciente (0040). Vazio = padrão. */
export async function salvarMensagemAniversario(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const texto = String(formData.get("mensagem_aniversario") ?? "").trim();
  if (texto.length > LIMITES.aniversario.mensagem) {
    return { fieldErrors: { mensagem_aniversario: [`Máximo de ${LIMITES.aniversario.mensagem} caracteres`] } };
  }

  // Policy psicologas_update_own: só a própria linha.
  const { data, error } = await supabase
    .from("psicologas")
    .update({ mensagem_aniversario: texto || null })
    .eq("id", user.id)
    .select("id");

  if (error || !data?.length) return { error: "Não foi possível salvar a mensagem." };

  revalidatePath("/configuracoes");
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  return { ok: true };
}
