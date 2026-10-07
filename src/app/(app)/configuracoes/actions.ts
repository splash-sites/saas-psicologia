"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { preferenciasLembreteSchema } from "@/lib/lembretes/schema";

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
