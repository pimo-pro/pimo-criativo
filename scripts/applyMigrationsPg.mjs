/**
 * Aplica ficheiros SQL em supabase/migrations via conexão Postgres directa.
 * Requer target explícito + identidade canónica (migrateTargetGuard).
 *
 * Importar este módulo NÃO aplica migrations — só a execução directa o faz.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadMigrateEnv } from "./migrateEnv.mjs";
import {
  assertMigrateTargetOrExit,
  redactConnectionString,
} from "./migrateTargetGuard.mjs";
import {
  connectionCandidates,
  connectPg,
  parsePgConfig,
} from "./migratePgConnection.mjs";
import { selectMigrations } from "./migrateExclude.mjs";

export { connectionCandidates, parsePgConfig, connectPg };
export {
  parseMigrateExclude,
  partitionMigrations,
  selectMigrations,
} from "./migrateExclude.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(path.resolve(entry)).href;
  } catch {
    return false;
  }
}

function listSortedMigrationFiles() {
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/** Log inequívoco: EXCLUDED / lista efectiva (sem APPLY/SKIP de DB). */
function logMigrationSelection(included, excluded) {
  for (const file of excluded) {
    console.log(`EXCLUDED ${file}`);
  }
  console.log(
    `Lista efectiva: ${included.length} migration(s) (excluídas: ${excluded.length})`,
  );
  for (const file of included) {
    console.log(`  EFFECTIVE ${file}`);
  }
}

async function main() {
  const env = loadMigrateEnv(root);
  assertMigrateTargetOrExit(env);

  const sorted = listSortedMigrationFiles();
  const { included, excluded } = selectMigrations(sorted, env);

  if (String(env.PIMO_MIGRATE_DRY_RUN ?? "").trim() === "1") {
    console.log(
      "DRY RUN — nenhuma migration será aplicada; sem writes em _pimo_schema_migrations.",
    );
    logMigrationSelection(included, excluded);
    console.log("DRY RUN — fim (sem ligação à base de dados).");
    return;
  }

  const candidates = await connectionCandidates(env);
  if (candidates.length === 0) {
    console.error(
      "ERRO: configure DATABASE_URL ou SUPABASE_DB_PASSWORD + VITE_SUPABASE_URL.",
    );
    process.exit(1);
  }

  console.log(
    `Candidatos de ligação: ${candidates.length} (redacted: ${redactConnectionString(candidates[0])})`,
  );

  logMigrationSelection(included, excluded);
  console.log(`Aplicar ${included.length} migrations...`);

  const client = await connectPg(candidates);

  try {
    await client.query(`
    CREATE TABLE IF NOT EXISTS public._pimo_schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

    // Apenas `included`: excluídas ficam pending (não APPLY, não INSERT no tracking).
    for (const file of included) {
      const { rows } = await client.query(
        "SELECT 1 FROM public._pimo_schema_migrations WHERE filename = $1",
        [file],
      );
      if (rows.length > 0) {
        console.log(`SKIP ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      console.log(`APPLY ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO public._pimo_schema_migrations (filename) VALUES ($1)",
          [file],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    const tables = [
      "users",
      "industrial_work_orders",
      "industrial_work_order_tasks",
      "industrial_work_order_events",
      "industrial_piece_operations",
      "industrial_piece_quality",
      "industrial_piece_time_entries",
      "system_settings",
      "system_events",
    ];

    for (const table of tables) {
      const check = await client.query(`SELECT to_regclass($1) AS reg`, [
        `public.${table}`,
      ]);
      if (!check.rows[0]?.reg) {
        throw new Error(`Tabela em falta após migrations: ${table}`);
      }
      console.log(`OK table ${table}`);
    }

    const views = [
      "industrial_operations",
      "industrial_quality",
      "industrial_time_tracking",
      "industrial_work_order_tasks_view",
      "industrial_tracking",
      "industrial_rework",
      "industrial_events",
      "industrial_settings",
    ];

    for (const view of views) {
      const check = await client.query(`SELECT to_regclass($1) AS reg`, [
        `public.${view}`,
      ]);
      if (!check.rows[0]?.reg) {
        throw new Error(`View em falta após migrations: ${view}`);
      }
      console.log(`OK view ${view}`);
    }

    const userColumns = await client.query(
      `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'users'
     ORDER BY ordinal_position`,
    );
    const expectedUserColumns = ["id", "email", "name", "role", "created_at"];
    const foundUserColumns = userColumns.rows.map((row) => row.column_name);
    for (const column of expectedUserColumns) {
      if (!foundUserColumns.includes(column)) {
        throw new Error(`Coluna em falta em public.users: ${column}`);
      }
    }
    console.log(`OK columns public.users (${foundUserColumns.join(", ")})`);

    const userRls = await client.query(
      `SELECT c.relrowsecurity AS enabled
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'users'`,
    );
    if (!userRls.rows[0]?.enabled) {
      throw new Error("RLS inactivo em public.users.");
    }
    console.log("OK RLS public.users");

    const userPolicies = await client.query(
      `SELECT policyname
     FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'users'
     ORDER BY policyname`,
    );
    const policyNames = userPolicies.rows.map((row) => row.policyname);
    for (const policy of ["users_select_all", "users_insert_all"]) {
      if (!policyNames.includes(policy)) {
        throw new Error(`Policy em falta em public.users: ${policy}`);
      }
    }
    console.log(`OK policies public.users (${policyNames.join(", ")})`);

    const industrialUser = await client.query(
      `SELECT id, email, name, role
     FROM public.users
     WHERE lower(email) = lower($1)
     LIMIT 1`,
      ["pimo-trak-industrial@pimo.pro"],
    );
    if (industrialUser.rows.length === 0) {
      throw new Error("Utilizador industrial padrão em falta em public.users.");
    }
    console.log("OK seed PIMO-TRAK industrial user", {
      id: industrialUser.rows[0].id,
      email: industrialUser.rows[0].email,
      role: industrialUser.rows[0].role,
    });

    const supabaseUrl = env.VITE_SUPABASE_URL?.trim();
    const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();
    if (supabaseUrl && anonKey) {
      const supabase = createClient(supabaseUrl, anonKey);
      const { data: byEmail, error: selectError } = await supabase
        .from("users")
        .select("id, email, name, role")
        .ilike("email", "pimo-trak-industrial@pimo.pro")
        .maybeSingle();
      if (selectError || !byEmail?.id) {
        throw new Error(
          `REST SELECT users falhou: ${selectError?.message ?? "sem dados"}`,
        );
      }
      console.log("OK REST SELECT users", byEmail.id);

      const testEmail = `migration-test-${Date.now()}@pimo.pro.test`;
      const { data: inserted, error: insertError } = await supabase
        .from("users")
        .insert({
          email: testEmail,
          name: "Migration Test",
          role: "test",
        })
        .select("id")
        .single();
      if (insertError || !inserted?.id) {
        throw new Error(
          `REST INSERT users falhou: ${insertError?.message ?? "sem id"}`,
        );
      }
      console.log("OK REST INSERT users", inserted.id);

      const { error: deleteError } = await supabase
        .from("users")
        .delete()
        .eq("id", inserted.id);
      if (deleteError) {
        throw new Error(`REST DELETE users falhou: ${deleteError.message}`);
      }
      console.log("OK REST DELETE users cleanup");
    } else {
      console.warn(
        "AVISO: VITE_SUPABASE_URL/ANON_KEY ausentes — validação REST users ignorada.",
      );
    }
  } finally {
    await client.end();
  }

  console.log("Migrations concluídas.");
}

if (isDirectRun()) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
