import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    // Playwright specs live in tests/e2e and are run by `pnpm test:e2e`.
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    globals: true,
  },
});
