/**
 * Valida views industriais 014 e cobertura de metadata nas tasks.
 * Requer target explícito + identidade canónica (mesmo guard que apply).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadMigrateEnv } from "./migrateEnv.mjs";
import { assertMigrateTargetOrExit } from "./migrateTargetGuard.mjs";
import {
  connectionCandidates,
  connectPg,
} from "./migratePgConnection.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const env = loadMigrateEnv(root);
assertMigrateTargetOrExit(env);

const candidates = await connectionCandidates(env);
if (candidates.length === 0) {
  console.error(
    "ERRO: configure DATABASE_URL ou SUPABASE_DB_PASSWORD + VITE_SUPABASE_URL.",
  );
  process.exit(1);
}

const client = await connectPg(candidates);

try {
  const migration = await client.query(
    "SELECT applied_at FROM public._pimo_schema_migrations WHERE filename = $1",
    ["014_industrial_work_order_tasks_view.sql"],
  );
  if (migration.rows.length === 0) {
    console.error("ERRO: migration 014 não registada em _pimo_schema_migrations.");
    process.exit(1);
  }
  console.log(`OK migration 014 aplicada em ${migration.rows[0].applied_at}`);

  for (const view of ["industrial_work_order_tasks_view", "industrial_tracking"]) {
    const check = await client.query("SELECT to_regclass($1) AS reg", [
      `public.${view}`,
    ]);
    if (!check.rows[0]?.reg) {
      console.error(`ERRO: view em falta: ${view}`);
      process.exit(1);
    }
    console.log(`OK view ${view}`);
  }

  const columns = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'industrial_work_order_tasks_view'
      AND column_name IN ('project_code', 'box_code', 'piece_code', 'full_industrial_name', 'nqr_code')
    ORDER BY column_name
  `);
  const expected = [
    "box_code",
    "full_industrial_name",
    "nqr_code",
    "piece_code",
    "project_code",
  ];
  const found = columns.rows.map((row) => row.column_name);
  for (const col of expected) {
    if (!found.includes(col)) {
      console.error(`ERRO: coluna em falta na view: ${col}`);
      process.exit(1);
    }
  }
  console.log(`OK colunas industriais na view (${found.join(", ")})`);

  const stats = await client.query(`
    SELECT
      COUNT(*)::int AS total_tasks,
      COUNT(*) FILTER (
        WHERE COALESCE(NULLIF(metadata->>'full_industrial_name', ''), '') <> ''
      )::int AS tasks_with_metadata_name,
      COUNT(*) FILTER (
        WHERE COALESCE(NULLIF(metadata->>'full_industrial_name', ''), '') = ''
      )::int AS tasks_without_metadata_name
    FROM public.industrial_work_order_tasks
  `);
  const row = stats.rows[0];
  console.log(
    `Tasks: total=${row.total_tasks} com_metadata=${row.tasks_with_metadata_name} sem_metadata=${row.tasks_without_metadata_name}`,
  );

  const viewStats = await client.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE COALESCE(NULLIF(full_industrial_name, ''), '') <> ''
      )::int AS with_name
    FROM public.industrial_work_order_tasks_view
  `);
  console.log(
    `View tasks: total=${viewStats.rows[0].total} com_nome=${viewStats.rows[0].with_name}`,
  );

  const recent = await client.query(`
    SELECT
      t.created_at,
      COALESCE(NULLIF(t.metadata->>'full_industrial_name', ''), '') AS meta_name,
      COALESCE(NULLIF(v.full_industrial_name, ''), '') AS view_name
    FROM public.industrial_work_order_tasks t
    LEFT JOIN public.industrial_work_order_tasks_view v ON v.id = t.id
    ORDER BY t.created_at DESC
    LIMIT 5
  `);
  console.log("Amostra (5 tasks mais recentes):");
  for (const sample of recent.rows) {
    console.log(
      `  ${sample.created_at} meta=${sample.meta_name || "—"} view=${sample.view_name || "—"}`,
    );
  }

  if (Number(row.total_tasks) === 0) {
    console.log(
      "AVISO: sem tasks — metadata industrial será validada na criação de novas WOs.",
    );
  } else if (Number(row.tasks_with_metadata_name) === 0) {
    console.log(
      "AVISO: nenhuma task antiga tem metadata persistida; nomes resolvem no cliente via cutlist PROJETOS.",
    );
  }

  const trackingCheck = await client.query(`
    SELECT COUNT(*)::int AS n
    FROM public.industrial_tracking
    WHERE COALESCE(NULLIF(full_industrial_name, ''), '') <> ''
  `);
  console.log(`industrial_tracking com nome: ${trackingCheck.rows[0].n}`);

  console.log("Validação industrial concluída.");
} finally {
  await client.end();
}
