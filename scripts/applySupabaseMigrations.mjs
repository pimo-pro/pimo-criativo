/**
 * Aplica migrations via Supabase CLI (link + db push).
 * Requer o MESMO target guard que applyMigrationsPg.
 *
 * Preferir applyMigrationsPg.mjs para init Staging (tracking _pimo_schema_migrations).
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadMigrateEnv } from "./migrateEnv.mjs";
import {
  assertMigrateTargetOrExit,
  CANONICAL_PROJECT_REFS,
} from "./migrateTargetGuard.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const env = loadMigrateEnv(root);
const targetCheck = assertMigrateTargetOrExit(env);

const accessToken = env.SUPABASE_ACCESS_TOKEN?.trim();
if (!accessToken) {
  console.error("ERRO: SUPABASE_ACCESS_TOKEN em falta.");
  process.exit(1);
}

const projectRef = targetCheck.actualRef;
if (
  targetCheck.target === "staging" &&
  projectRef !== CANONICAL_PROJECT_REFS.staging
) {
  console.error("ERRO: ref staging inválido após guard.");
  process.exit(1);
}
if (
  targetCheck.target === "production" &&
  projectRef !== CANONICAL_PROJECT_REFS.production
) {
  console.error("ERRO: ref production inválido após guard.");
  process.exit(1);
}

const migrationsDir = path.join(root, "supabase", "migrations");
const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

console.log(`Migrations encontradas: ${files.length}`);
for (const file of files) {
  console.log(`  - ${file}`);
}

const childEnv = {
  ...process.env,
  SUPABASE_ACCESS_TOKEN: accessToken,
};

console.log(
  `\nA ligar projecto ${projectRef} (target=${targetCheck.target}) e aplicar migrations...`,
);

execSync(`npx supabase link --project-ref ${projectRef} --yes`, {
  cwd: root,
  stdio: "inherit",
  env: childEnv,
});

execSync("npx supabase db push --yes", {
  cwd: root,
  stdio: "inherit",
  env: childEnv,
});

console.log("Migrations Supabase CLI concluídas.");
