/**
 * Regeneração runtime das metadata N-QR v5 em industrial_work_order_tasks.
 * Usa funções existentes (resolveAuthoritativeLabelNumber + buildEtiquetaCodeV5).
 *
 * Requer VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (ou DATABASE_URL para validação prévia).
 * Uso: node scripts/regenerateIndustrialWorkOrderNqr.mjs
 */

import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    out[trimmed.slice(0, idx)] = trimmed.slice(idx + 1).trim();
  }
  return out;
}

const envFromFiles = {
  ...loadEnvFile(path.join(rootDir, ".env")),
  ...loadEnvFile(path.join(rootDir, ".env.production")),
  ...process.env,
};

const supabaseUrl = String(envFromFiles.VITE_SUPABASE_URL ?? "").trim();
const supabaseKey = String(envFromFiles.VITE_SUPABASE_ANON_KEY ?? "").trim();

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "ERRO: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórios para regenerar metadata N-QR.",
  );
  console.error(
    "Configure .env.production ou exporte as variáveis antes de executar este script.",
  );
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [
    path.join(rootDir, "node_modules", "vitest", "vitest.mjs"),
    "run",
    "src/industrial/work-orders/regenerateWorkOrderNqrMetadata.test.ts",
  ],
  {
    cwd: rootDir,
    stdio: "inherit",
    env: {
      ...process.env,
      ...envFromFiles,
      REGEN_NQR: "1",
      VITE_SUPABASE_URL: supabaseUrl,
      VITE_SUPABASE_ANON_KEY: supabaseKey,
      VITE_API_URL: envFromFiles.VITE_API_URL || "https://pimo.pro",
    },
  },
);

process.exit(result.status ?? 1);
