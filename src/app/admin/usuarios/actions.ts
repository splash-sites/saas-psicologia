"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminAtual } from "@/lib/admin/acesso";
import { estenderTesteSchema } from "@/lib/admin/usuarios";

export type FormState = { error?: string; fieldErrors?: Record<string, string[]>; ok?: string };

/**
 * Estende o teste de uma conta que ainda não assinou (a regra está no banco:
 * admin_estender_teste, migration 0028), com o registro de dias e motivo.
 */
export async function estenderTeste(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await adminAtual();
  if (!admin) return { error: "Não encontrado." };
  const parsed = estenderTesteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const { data: status, error } = await createAdminClient().rpc("admin_estender_teste", {
    p_psicologa_id: id,
    p_dias: parsed.data.dias,
    p_motivo: parsed.data.motivo,
    p_admin: admin.email ?? "admin",
  });
  if (error) return { error: "Não foi possível estender o teste. Tente de novo." };
  if (status === "ja_assinou") {
    return { error: "Esta conta já assinou: a data da cobrança está no Asaas e precisa ser mudada lá." };
  }
  revalidatePath(`/admin/usuarios/${id}`);
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin");
  return { ok: `Teste estendido em ${parsed.data.dias} dias.` };
}
