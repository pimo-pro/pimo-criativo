/**
 * Probe PostgreSQL read-only — SELECT 1 + identidade via target guard.
 * Sem migrations, sem REST, sem escrita.
 *
 * Uso (CI): node scripts/connectionProbePg.mjs
 * Requer: PIMO_MIGRATE_TARGET + DATABASE_URL (+ identidade canónica).
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadMigrateEnv } from "./migrateEnv.mjs";
import {
  assertMigrateTargetOrExit,
  normalizeMigrateTarget,
} from "./migrateTargetGuard.mjs";
import {
  connectionCandidates,
  connectPg,
  parsePgConfig,
} from "./migratePgConnection.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

/**
 * Defesa extra: staging nunca deve ter SUPABASE_DB_PASSWORD preenchido.
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export function assertStagingDbPasswordEmpty(env) {
  const target = normalizeMigrateTarget(env?.PIMO_MIGRATE_TARGET);
  if (target === "staging" && String(env?.SUPABASE_DB_PASSWORD ?? "").trim() !== "") {
    return {
      ok: false,
      code: "STAGING_PASSWORD_FORBIDDEN",
      message:
        "SUPABASE_DB_PASSWORD deve estar vazio para target=staging (anti-fallback Production).",
    };
  }
  return { ok: true };
}

function sanitizedHostFromDatabaseUrl(databaseUrl) {
  try {
    return parsePgConfig(databaseUrl).host || "(unknown)";
  } catch {
    return "(unparseable)";
  }
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(path.resolve(entry)).href;
  } catch {
    return false;
  }
}

async function main() {
  const env = loadMigrateEnv(root);
  const targetCheck = assertMigrateTargetOrExit(env);

  const pwCheck = assertStagingDbPasswordEmpty(env);
  if (!pwCheck.ok) {
    console.error(`ERRO connection probe [${pwCheck.code}]: ${pwCheck.message}`);
    console.log("RESULT: FAIL");
    process.exit(1);
  }

  const databaseUrl = String(env.DATABASE_URL ?? "").trim();
  if (!databaseUrl) {
    console.error("ERRO connection probe: DATABASE_URL obrigatório.");
    console.log("RESULT: FAIL");
    process.exit(1);
  }

  const host = sanitizedHostFromDatabaseUrl(databaseUrl);
  // Log seguro — nunca URI completa nem password
  console.log(`target: ${targetCheck.target}`);
  console.log(`expected_project_ref: ${targetCheck.expectedRef}`);
  console.log(`actual_project_ref: ${targetCheck.actualRef}`);
  console.log(`hostname: ${host}`);

  const candidates = await connectionCandidates(env);
  if (candidates.length === 0) {
    console.error("ERRO connection probe: sem candidatos de ligação.");
    console.log("RESULT: FAIL");
    process.exit(1);
  }

  const client = await connectPg(candidates);
  try {
    const { rows } = await client.query("SELECT 1 AS ok");
    const ok = rows?.[0]?.ok === 1 || rows?.[0]?.ok === "1";
    console.log(`select_1: ${ok ? "PASS" : "FAIL"}`);
    if (!ok) {
      console.log("RESULT: FAIL");
      process.exit(1);
    }
    console.log("RESULT: PASS");
  } finally {
    await client.end();
  }
}

if (isDirectRun()) {
  main().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    // Evitar eco de connection strings no stack se a mensagem as contiver
    console.error(`ERRO connection probe: ${msg.replace(/postgresql:\/\/[^\s]+/gi, "postgresql://***")}`);
    console.log("RESULT: FAIL");
    process.exit(1);
  });
}
