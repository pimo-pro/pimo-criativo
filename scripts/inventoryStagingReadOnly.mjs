/**
 * Inventário READ-ONLY da base (Staging) — apenas SELECT.
 * Sem INSERT/UPDATE/DELETE/DDL/GRANT. Sem migrations.
 *
 * Uso: PIMO_MIGRATE_TARGET=staging node scripts/inventoryStagingReadOnly.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadMigrateEnv } from "./migrateEnv.mjs";
import {
  assertMigrateTargetOrExit,
  normalizeMigrateTarget,
  redactConnectionString,
} from "./migrateTargetGuard.mjs";
import {
  connectionCandidates,
  connectPg,
  parsePgConfig,
} from "./migratePgConnection.mjs";
import { assertStagingDbPasswordEmpty } from "./connectionProbePg.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");

const INDUSTRIAL_TABLES = [
  "industrial_work_orders",
  "industrial_work_order_tasks",
  "industrial_work_order_events",
  "industrial_piece_transforms",
  "industrial_piece_edges",
  "industrial_piece_operations",
  "industrial_piece_quality",
  "industrial_piece_time_entries",
  "industrial_piece_remates",
  "system_settings",
  "system_events",
];

const FILE_015 = "015_revoke_industrial_anon_write.sql";

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(path.resolve(entry)).href;
  } catch {
    return false;
  }
}

function listRepoMigrations() {
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function phaseAStatus(filename, tracking) {
  if (filename === FILE_015) return "EXCLUDED";
  if (tracking === "APPLIED") return "SKIP";
  return "APPLY";
}

async function main() {
  const env = loadMigrateEnv(root);
  const targetCheck = assertMigrateTargetOrExit(env);

  if (normalizeMigrateTarget(env.PIMO_MIGRATE_TARGET) !== "staging") {
    console.error("ERRO inventário: apenas target=staging é permitido neste script.");
    process.exit(1);
  }

  const pwCheck = assertStagingDbPasswordEmpty(env);
  if (!pwCheck.ok) {
    console.error(`ERRO inventário [${pwCheck.code}]: ${pwCheck.message}`);
    process.exit(1);
  }

  console.log("=== STAGING READ-ONLY INVENTORY ===");
  console.log(`Migration target OK: ${targetCheck.target}`);
  console.log(`expected_project_ref: ${targetCheck.expectedRef}`);
  console.log(`actual_project_ref: ${targetCheck.actualRef}`);
  console.log("READ_ONLY: YES");
  console.log("SQL_MODE: SELECT_ONLY");

  const candidates = await connectionCandidates(env);
  if (candidates.length === 0) {
    console.error("ERRO inventário: DATABASE_URL (ou equivalente) em falta.");
    process.exit(1);
  }

  let host = "(unknown)";
  try {
    host = parsePgConfig(candidates[0]).host || host;
  } catch {
    /* ignore */
  }
  console.log(`connection_host: ${host}`);
  console.log(`connection_redacted: ${redactConnectionString(candidates[0])}`);

  const client = await connectPg(candidates);
  console.log("Connection: PASS");

  try {
    const ping = await client.query("SELECT 1 AS ok");
    console.log(`select_1: ${ping.rows[0]?.ok}`);

    // --- 1 tracking ---
    console.log("\n=== INVENTORY 1: _pimo_schema_migrations ===");
    const trackingExists = await client.query(
      `SELECT to_regclass('public._pimo_schema_migrations') AS reg`,
    );
    const hasTracking = Boolean(trackingExists.rows[0]?.reg);
    let appliedRows = [];
    if (!hasTracking) {
      console.log("_pimo_schema_migrations = NOT FOUND");
    } else {
      console.log("_pimo_schema_migrations = EXISTS");
      const cols = await client.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = '_pimo_schema_migrations'
         ORDER BY ordinal_position`,
      );
      const colNames = cols.rows.map((r) => r.column_name);
      console.log(`columns: ${colNames.join(", ")}`);
      const hasAppliedAt = colNames.includes("applied_at");
      const q = hasAppliedAt
        ? `SELECT filename, applied_at
           FROM public._pimo_schema_migrations
           ORDER BY filename`
        : `SELECT filename
           FROM public._pimo_schema_migrations
           ORDER BY filename`;
      const res = await client.query(q);
      appliedRows = res.rows;
      console.log(`applied_count: ${appliedRows.length}`);
      for (const row of appliedRows) {
        if (hasAppliedAt) {
          console.log(`APPLIED\t${row.filename}\t${row.applied_at?.toISOString?.() ?? row.applied_at}`);
        } else {
          console.log(`APPLIED\t${row.filename}`);
        }
      }
    }

    const appliedSet = new Set(appliedRows.map((r) => r.filename));

    // --- 2 tables ---
    console.log("\n=== INVENTORY 2: public BASE TABLE ===");
    const tables = await client.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );
    console.log(`table_count: ${tables.rows.length}`);
    for (const row of tables.rows) {
      console.log(`TABLE\t${row.table_name}`);
    }

    // approx rows via pg_class.reltuples (metadata, no full scan)
    console.log("\n=== INVENTORY 2b: approx row estimate (reltuples) ===");
    const estimates = await client.query(
      `SELECT c.relname AS table_name, c.reltuples::bigint AS approx_rows
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relkind = 'r'
       ORDER BY c.relname`,
    );
    for (const row of estimates.rows) {
      console.log(`ROWS_EST\t${row.table_name}\t${row.approx_rows}`);
    }

    // --- 3 views ---
    console.log("\n=== INVENTORY 3: public VIEW ===");
    const views = await client.query(
      `SELECT table_name
       FROM information_schema.views
       WHERE table_schema = 'public'
       ORDER BY table_name`,
    );
    console.log(`view_count: ${views.rows.length}`);
    for (const row of views.rows) {
      console.log(`VIEW\t${row.table_name}`);
    }

    // --- 4 RLS ---
    console.log("\n=== INVENTORY 4: RLS (pg_class) ===");
    const rls = await client.query(
      `SELECT c.relname AS table_name,
              c.relrowsecurity AS relrowsecurity,
              c.relforcerowsecurity AS relforcerowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relkind = 'r'
       ORDER BY c.relname`,
    );
    for (const row of rls.rows) {
      console.log(
        `RLS\t${row.table_name}\trowsecurity=${row.relrowsecurity}\tforce=${row.relforcerowsecurity}`,
      );
    }

    // --- 5 policies ---
    console.log("\n=== INVENTORY 5: pg_policies ===");
    const policies = await client.query(
      `SELECT tablename, policyname, permissive, roles::text AS roles, cmd
       FROM pg_policies
       WHERE schemaname = 'public'
       ORDER BY tablename, policyname`,
    );
    console.log(`policy_count: ${policies.rows.length}`);
    for (const row of policies.rows) {
      console.log(
        `POLICY\t${row.tablename}\t${row.policyname}\t${row.permissive}\t${row.roles}\t${row.cmd}`,
      );
    }

    // --- 6 industrial ---
    console.log("\n=== INVENTORY 6: industrial tables ===");
    for (const name of INDUSTRIAL_TABLES) {
      const check = await client.query(`SELECT to_regclass($1) AS reg`, [
        `public.${name}`,
      ]);
      const status = check.rows[0]?.reg ? "EXISTS" : "MISSING";
      console.log(`INDUSTRIAL\t${name}\t${status}`);
    }

    // --- 6b privileges / ACL (SELECT only; pre-016 gate) ---
    const apiRoles = ["anon", "authenticated", "service_role", "PUBLIC"];
    console.log("\n=== INVENTORY 6b: owner + relacl ===");
    const owners = await client.query(
      `SELECT c.relname AS table_name,
              pg_get_userbyid(c.relowner) AS owner,
              c.relacl::text AS relacl
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relkind IN ('r', 'v')
         AND c.relname = ANY($1::text[])
       ORDER BY c.relname`,
      [
        [
          ...INDUSTRIAL_TABLES,
          "industrial_work_order_tasks_view",
          "industrial_tracking",
          "industrial_operations",
          "industrial_quality",
          "industrial_time_tracking",
          "industrial_rework",
          "industrial_settings",
          "industrial_events",
        ],
      ],
    );
    for (const row of owners.rows) {
      console.log(
        `OWNER\t${row.table_name}\t${row.owner}\trelacl=${row.relacl ?? "(null)"}`,
      );
    }

    console.log("\n=== INVENTORY 6c: role_table_grants (API roles) ===");
    const grants = await client.query(
      `SELECT table_name, grantee, privilege_type, is_grantable
       FROM information_schema.role_table_grants
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])
         AND grantee = ANY($2::text[])
       ORDER BY table_name, grantee, privilege_type`,
      [INDUSTRIAL_TABLES, apiRoles],
    );
    console.log(`grant_rows: ${grants.rows.length}`);
    for (const row of grants.rows) {
      console.log(
        `GRANT\t${row.table_name}\t${row.grantee}\t${row.privilege_type}\tgrantable=${row.is_grantable}`,
      );
    }
    if (grants.rows.length === 0) {
      console.log(
        "GRANT_CATALOG: EMPTY for anon/authenticated/service_role/PUBLIC on industrial base tables",
      );
    }

    console.log("\n=== INVENTORY 6d: table_privileges ===");
    const tpriv = await client.query(
      `SELECT table_name, grantee, privilege_type
       FROM information_schema.table_privileges
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])
         AND grantee = ANY($2::text[])
       ORDER BY table_name, grantee, privilege_type`,
      [INDUSTRIAL_TABLES, apiRoles],
    );
    console.log(`table_privilege_rows: ${tpriv.rows.length}`);
    for (const row of tpriv.rows) {
      console.log(
        `TPRIV\t${row.table_name}\t${row.grantee}\t${row.privilege_type}`,
      );
    }

    console.log("\n=== INVENTORY 6e: has_table_privilege (effective) ===");
    for (const table of INDUSTRIAL_TABLES) {
      for (const role of ["anon", "authenticated", "service_role"]) {
        const bits = {};
        for (const p of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
          const r = await client.query(
            `SELECT has_table_privilege($1, $2, $3) AS ok`,
            [role, `public.${table}`, p],
          );
          bits[p] = Boolean(r.rows[0]?.ok);
        }
        console.log(
          `EFF\t${table}\t${role}\tS=${bits.SELECT}\tI=${bits.INSERT}\tU=${bits.UPDATE}\tD=${bits.DELETE}`,
        );
      }
    }

    console.log("\n=== INVENTORY 6f: schema USAGE + default ACL ===");
    for (const role of ["anon", "authenticated", "service_role"]) {
      const r = await client.query(
        `SELECT has_schema_privilege($1, 'public', 'USAGE') AS ok`,
        [role],
      );
      console.log(`SCHEMA_USAGE\t${role}\t${r.rows[0]?.ok}`);
    }
    const defs = await client.query(
      `SELECT pg_get_userbyid(d.defaclrole) AS grantor_role,
              COALESCE(n.nspname, '(global)') AS schema,
              d.defaclobjtype AS objtype,
              d.defaclacl::text AS acl
       FROM pg_default_acl d
       LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
       WHERE n.nspname IS NULL OR n.nspname = 'public'
       ORDER BY 1, 2, 3`,
    );
    console.log(`default_acl_rows: ${defs.rows.length}`);
    for (const row of defs.rows) {
      console.log(
        `DEFACL\tgrantor=${row.grantor_role}\tschema=${row.schema}\tobj=${row.objtype}\tacl=${row.acl}`,
      );
    }

    console.log("\n=== INVENTORY 6g: view grants (012/014) ===");
    const viewGrants = await client.query(
      `SELECT table_name, grantee, privilege_type
       FROM information_schema.role_table_grants
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])
         AND grantee = ANY($2::text[])
       ORDER BY table_name, grantee, privilege_type`,
      [
        [
          "industrial_work_order_tasks_view",
          "industrial_tracking",
          "industrial_operations",
          "industrial_quality",
          "industrial_time_tracking",
          "industrial_rework",
          "industrial_settings",
          "industrial_events",
        ],
        ["anon", "authenticated", "service_role", "PUBLIC"],
      ],
    );
    console.log(`view_grant_rows: ${viewGrants.rows.length}`);
    for (const row of viewGrants.rows) {
      console.log(
        `VGRANT\t${row.table_name}\t${row.grantee}\t${row.privilege_type}`,
      );
    }

    // --- 7 comparison ---
    console.log("\n=== INVENTORY 7: repo migrations vs tracking ===");
    const repoFiles = listRepoMigrations();
    console.log(`repo_migration_count: ${repoFiles.length}`);
    const pending = [];
    const appliedList = [];
    for (const file of repoFiles) {
      const tracking = appliedSet.has(file) ? "APPLIED" : "PENDING";
      const phase = phaseAStatus(file, tracking);
      console.log(`COMPARE\t${file}\t${tracking}\t${phase}`);
      if (tracking === "APPLIED") appliedList.push(file);
      else pending.push(file);
    }

    const status015 = appliedSet.has(FILE_015) ? "APPLIED" : "PENDING";
    console.log("\n=== SUMMARY ===");
    console.log(`migrations_applied: ${appliedList.length}`);
    console.log(`migrations_pending: ${pending.length}`);
    console.log(`015_status: ${status015}`);
    console.log(`015_phase_a: EXCLUDED`);
    if (status015 === "APPLIED") {
      console.log("ALERT: 015 already APPLIED on staging — report only, do not revert.");
    }
    console.log("READ-ONLY = YES");
    console.log("DATABASE CHANGES = NONE");
    console.log("SQL WRITES = NONE");
    console.log("MIGRATIONS = NONE");
    console.log("RESULT: PASS");
  } finally {
    await client.end();
  }
}

if (isDirectRun()) {
  main().catch((err) => {
    console.error(err?.message ?? err);
    process.exit(1);
  });
}
