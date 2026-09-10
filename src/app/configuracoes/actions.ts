"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function desconectarGoogle(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
