"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";

/**
 * Registra que a psicóloga abriu o WhatsApp para lembrar este paciente.
 * O horário gravado é o da consulta no banco (não o que veio do cliente):
 * se ela for remarcada depois, o registro antigo deixa de valer.
 */
export async function marcarLembreteEnviado(
  consultaId: string,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) return { ok: false };

  // RLS: só enxerga a consulta se for dela.
  const { data: consulta } = await supabase
    .from("consultas")
    .select("id, inicio")
    .eq("id", consultaId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!consulta) return { ok: false };

  const { error } = await supabase.from("lembretes").upsert(
    {
      psicologa_id: user.id,
      consulta_id: consulta.id,
      canal: "whatsapp_manual",
      consulta_inicio: consulta.inicio,
      enviado_em: new Date().toISOString(),
    },
    { onConflict: "consulta_id,canal" },
  );
  if (error) return { ok: false };

  revalidatePath("/lembretes");
  return { ok: true };
}
