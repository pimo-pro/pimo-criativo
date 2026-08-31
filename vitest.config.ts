import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

/**
 * Configuração Vitest para testes industriais (Fase 7) e validações.
 * Alias `@` alinhado ao vite.config (necessário para IndustrialCenter / live store).
 * Não altera build, TCN, topDrillable nem exportações CNC.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    environment: "node",
    globals: false,
    // Default de 5s é insuficiente: há testes de pipeline industrial completo e
    // varrimentos de toda a árvore src/ que excedem 5s sob execução paralela.
    testTimeout: 30_000,
  },
});
