/**
 * Strict SSOT gavetas — bloqueia o build se constantes sagradas forem alteradas.
 * Invocado via `prebuild` / `npm run test:ssot`.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const result = spawnSync(
  process.execPath,
  [
    path.join(rootDir, "node_modules", "vitest", "vitest.mjs"),
    "run",
    "src/validation/drawerSsotStrictGuard.test.ts",
    "src/validation/drawerGav1SsotAbsolute.test.ts",
    "src/core/drawers/drilling/drawerProgressivasRunnerAlign.test.ts",
    "--reporter=dot",
  ],
  { cwd: rootDir, stdio: "inherit", shell: false }
);

if ((result.status ?? 1) !== 0) {
  console.error(
    "\n[SSOT GAV] Build bloqueado: constantes 18,5 / 22,5 / 41 / floorTop / Viewer rev inválidas.\n"
  );
  process.exit(result.status ?? 1);
}

console.log("[SSOT GAV] Strict guard OK — 18,5 / 22,5 / 41 / floorTop / Viewer.");
