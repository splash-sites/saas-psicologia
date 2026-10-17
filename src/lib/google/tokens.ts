import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto";
import {
  escopoTemCalendar,
  integracaoGoogleConfigurada,
  trocarRefreshToken,
} from "./calendar";

export type ResultadoToken = "guardado" | "sem_permissao" | "ignorado";

// Guarda o refresh token do Google para uso server-side posterior na Calendar
// API, criptografado antes de persistir. Só sobrescreve se a permissão da
// Agenda foi de fato concedida: o Google deixa a usuária desmarcá-la na tela de
// consentimento, e um token sem ela quebraria a sincronização que já funcionava.
export async function guardarRefreshTokenGoogle(
  psicologaId: string,
  refreshToken: string | null | undefined,
): Promise<ResultadoToken> {
  if (!refreshToken || !integracaoGoogleConfigurada()) return "ignorado";
  try {
    const { scope } = await trocarRefreshToken(refreshToken);
    if (!escopoTemCalendar(scope)) return "sem_permissao";

    await createAdminClient()
      .from("google_oauth_tokens")
      .upsert(
        {
          psicologa_id: psicologaId,
          refresh_token_cifrado: encrypt(refreshToken),
          escopo: scope,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "psicologa_id" },
      );
    return "guardado";
  } catch {
    // Não bloqueia o login se a persistência do token falhar.
    return "ignorado";
  }
}
