import { createClient } from "@supabase/supabase-js";

// Client com service_role — ignora RLS. Uso EXCLUSIVO server-side, em fluxos
// que precisam escrever tabelas sem policy de insert/update (ex: guardar o
// refresh token do Google no callback de auth). Nunca importar em código client.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function adminDisponivel(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
