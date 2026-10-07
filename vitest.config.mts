import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    pool: "threads",
    // tests/e2e roda no Playwright (npm run e2e), não no Vitest.
    exclude: ["**/node_modules/**", "tests/e2e/**"],
  },
});
