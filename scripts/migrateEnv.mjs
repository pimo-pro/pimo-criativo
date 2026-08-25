/**
 * Carregamento de env para scripts de migration — sem misturar Production em Staging.
 */
import fs from "node:fs";
import path from "node:path";
import { normalizeMigrateTarget } from "./migrateTargetGuard.mjs";

export function loadEnvFile(filePath) {
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

/**
 * Precedência:
 * 1. .env (base local)
 * 2. ficheiro específico do target (.env.staging | .env.production) — só esse
 * 3. process.env (ganha)
 *
 * Nunca carrega .env.production quando o target é staging/local.
 */
export function loadMigrateEnv(rootDir) {
  const root = rootDir;
  const base = loadEnvFile(path.join(root, ".env"));
  const mergedPeek = { ...base, ...process.env };
  const target = normalizeMigrateTarget(mergedPeek.PIMO_MIGRATE_TARGET);

  let specific = {};
  if (target === "staging") {
    specific = loadEnvFile(path.join(root, ".env.staging"));
  } else if (target === "production") {
    specific = loadEnvFile(path.join(root, ".env.production"));
  }
  // local / target em falta: apenas .env + process.env (fail-closed no guard)

  return {
    ...base,
    ...specific,
    ...process.env,
  };
}
