import { expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const url = process.env.SUPABASE_TEST_URL;
export const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
export const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
export const hasLocalSupabase = Boolean(url && anonKey);
export const hasAdmin = Boolean(url && serviceRoleKey);

// Client com service_role — ignora RLS. Só para ajustar estado de teste que
// nenhum client autenticado consegue tocar (ex: app_config).
export function adminClient(): SupabaseClient {
  return createClient(url!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Client anônimo sem persistência de sessão — usado só para signUp.
export function anonClient(): SupabaseClient {
  return createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Client autenticado como um usuário específico, via bearer token explícito.
// Evita o compartilhamento de storage entre instâncias do GoTrueClient no jsdom.
export function userClient(accessToken: string): SupabaseClient {
  return createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export async function signUpPsicologa(email: string, password = "senha-teste-123456") {
  const { data, error } = await anonClient().auth.signUp({ email, password });
  expect(error).toBeNull();
  expect(data.session).not.toBeNull();
  return { id: data.user!.id, accessToken: data.session!.access_token };
}
