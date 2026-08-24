/**
 * Smoke TCN pós-Fase 7b — modos activos: nesting_mo + v2_new.
 *
 * Não replica a lógica antiga de v1 / tcnGenerator.ts (removidos).
 * Delega nos geradores oficiais via `scripts/gen-test-tcn.ts` (vite-node).
 *
 * Uso: node scripts/gen-test-tcn.mjs
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const runner = join(__dirname, "gen-test-tcn.ts");

const result = spawnSync("npx", ["vite-node", runner], {
  cwd: rootDir,
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
