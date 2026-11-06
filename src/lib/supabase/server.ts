import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ajustarValidade, COOKIE_LEMBRAR, lembrarDoValor } from "./lembrar";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // "Lembrar de mim" desmarcado: cookies de sessão (ver ./lembrar.ts).
          const lembrar = lembrarDoValor(cookieStore.get(COOKIE_LEMBRAR)?.value);
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, ajustarValidade(options, lembrar));
            }
          } catch {
            // setAll chamado de um Server Component sem middleware de refresh de sessão.
            // Pode ser ignorado se houver middleware renovando a sessão do usuário.
          }
        },
      },
    },
  );
}
