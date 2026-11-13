"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { TERMOS_ATUALIZADOS_EM } from "@/lib/termos";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Fecha o aviso de Termos/Privacidade atualizados (migration 0030). */
export async function marcarTermosVistos(): Promise<void> {
  const user = await usuarioAtual();
  if (!user) return;
  const supabase = await createClient();
  await supabase.from("psicologas").update({ termos_versao_vista: TERMOS_ATUALIZADOS_EM }).eq("id", user.id);
  revalidatePath("/dashboard");
}
