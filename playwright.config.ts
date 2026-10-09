import { execSync } from "node:child_process";
import { defineConfig } from "@playwright/test";

// E2E dos fluxos críticos (CLAUDE.md: login, paciente, evolução, pagamento)
// contra o BUILD DE PRODUÇÃO (next build + next start na porta 3200), apontando
// para o Supabase LOCAL. Produção de propósito: valida a CSP rígida (sem
// 'unsafe-eval'), que o `next dev` não exercita.
//
// Uso: npx supabase start && npm run e2e
// Recusa qualquer Supabase que não seja o local.

const PORTA = 3200;

function supabaseLocal() {
  const bruto = execSync("npx --yes supabase status -o json", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const s = JSON.parse(bruto.slice(bruto.indexOf("{"), bruto.lastIndexOf("}") + 1));
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(s.API_URL)) {
    throw new Error(`Recusado: ${s.API_URL} não é o Supabase local.`);
  }
  return s as { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string };
}

const sb = supabaseLocal();
// Os testes leem daqui para criar as contas pelo admin.
process.env.E2E_SUPABASE_URL = sb.API_URL;
process.env.E2E_SERVICE_ROLE_KEY = sb.SERVICE_ROLE_KEY;

export default defineConfig({
  testDir: "tests/e2e",
  // Fluxos dependem um do outro (mesma conta, em ordem).
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORTA}`,
    channel: "chrome",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    acceptDownloads: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx next build && npx next start -p ${PORTA}`,
    url: `http://localhost:${PORTA}/login`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: sb.API_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: sb.ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: sb.SERVICE_ROLE_KEY,
      ASAAS_MODE: "mock",
      ASAAS_WEBHOOK_TOKEN: "token-e2e",
      // Sem chaves do Google: a integração fica desativada (não chama a API real).
      GOOGLE_OAUTH_CLIENT_ID: "",
      GOOGLE_OAUTH_CLIENT_SECRET: "",
    },
  },
});
