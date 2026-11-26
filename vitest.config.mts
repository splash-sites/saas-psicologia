import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    // "server-only" só faz sentido no build do Next (quebra se um arquivo do
    // servidor for importado no navegador); no Vitest vira um módulo vazio.
    alias: { "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    pool: "threads",
    // tests/e2e roda no Playwright (npm run e2e), não no Vitest.
    exclude: ["**/node_modules/**", "tests/e2e/**"],
  },
});
