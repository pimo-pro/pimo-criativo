/**
 * Testes do mecanismo PIMO_MIGRATE_EXCLUDE (Phase A Staging).
 * Sem DB, sem SQL, sem secrets reais.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseMigrateExclude,
  partitionMigrations,
  selectMigrations,
} from "../../../scripts/migrateExclude.mjs";
import {
  CANONICAL_PROJECT_REFS,
  CANONICAL_SUPABASE_URLS,
  redactConnectionString,
  validateMigrateTarget,
} from "../../../scripts/migrateTargetGuard.mjs";

const FILE_015 = "015_revoke_industrial_anon_write.sql";
const SAMPLE = [
  "000_profiles_bootstrap.sql",
  "014_industrial_work_order_tasks_view.sql",
  FILE_015,
  "add_departments_columns.sql",
  "create_workflow_tables.sql",
];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("parseMigrateExclude", () => {
  it("1: variável ausente → lista vazia (todas entram)", () => {
    expect(parseMigrateExclude(undefined)).toEqual([]);
    expect(parseMigrateExclude(null)).toEqual([]);
  });

  it("2: variável vazia / whitespace → lista vazia", () => {
    expect(parseMigrateExclude("")).toEqual([]);
    expect(parseMigrateExclude("   ")).toEqual([]);
  });

  it("3: 015 isolada → excluída", () => {
    expect(parseMigrateExclude(FILE_015)).toEqual([FILE_015]);
  });

  it("4: CSV múltiplo → todos excluídos", () => {
    expect(
      parseMigrateExclude(
        "015_revoke_industrial_anon_write.sql,create_workflow_tables.sql",
      ),
    ).toEqual([FILE_015, "create_workflow_tables.sql"]);
  });

  it("5: whitespace no CSV → trim correcto", () => {
    expect(
      parseMigrateExclude(
        `  ${FILE_015} ,  add_departments_columns.sql  ,  `,
      ),
    ).toEqual([FILE_015, "add_departments_columns.sql"]);
  });
});

describe("partitionMigrations / selectMigrations", () => {
  it("3+6: 015 EXCLUDED e fora da lista efectiva", () => {
    const { included, excluded } = partitionMigrations(SAMPLE, [FILE_015]);
    expect(excluded).toEqual([FILE_015]);
    expect(included).not.toContain(FILE_015);
    expect(included).toEqual([
      "000_profiles_bootstrap.sql",
      "014_industrial_work_order_tasks_view.sql",
      "add_departments_columns.sql",
      "create_workflow_tables.sql",
    ]);
  });

  it("6+7: excluída não entra no conjunto a APPLY (simulação sem DB/tracking)", () => {
    const { included, excluded } = selectMigrations(SAMPLE, {
      PIMO_MIGRATE_EXCLUDE: FILE_015,
    });
    expect(excluded).toEqual([FILE_015]);
    // Loop de APPLY/INSERT só itera `included` — excluída nunca é candidata a tracking.
    const wouldApplyOrSkip = new Set(included);
    const wouldInsertTracking = [...wouldApplyOrSkip];
    expect(wouldApplyOrSkip.has(FILE_015)).toBe(false);
    expect(wouldInsertTracking).not.toContain(FILE_015);
  });

  it("8: execução posterior sem exclude → 015 volta a candidata", () => {
    const withExclude = selectMigrations(SAMPLE, {
      PIMO_MIGRATE_EXCLUDE: FILE_015,
    });
    expect(withExclude.included).not.toContain(FILE_015);

    const without = selectMigrations(SAMPLE, {});
    expect(without.excluded).toEqual([]);
    expect(without.included).toContain(FILE_015);

    const empty = selectMigrations(SAMPLE, { PIMO_MIGRATE_EXCLUDE: "" });
    expect(empty.included).toContain(FILE_015);
  });

  it("9: dry-run usa a mesma selecção (015 EXCLUDED, efectiva sem 015)", () => {
    const { included, excluded } = selectMigrations(SAMPLE, {
      PIMO_MIGRATE_EXCLUDE: FILE_015,
      PIMO_MIGRATE_DRY_RUN: "1",
    });
    expect(excluded).toEqual([FILE_015]);
    expect(included).not.toContain(FILE_015);
  });
});

describe("applyMigrationsPg wiring (estático)", () => {
  it("usa selectMigrations e log EXCLUDED; loop só sobre included", () => {
    const src = fs.readFileSync(
      path.join(root, "scripts/applyMigrationsPg.mjs"),
      "utf8",
    );
    expect(src).toContain('from "./migrateExclude.mjs"');
    expect(src).toContain("selectMigrations");
    expect(src).toContain("EXCLUDED ${file}");
    expect(src).toContain("EFFECTIVE ${file}");
    expect(src).toContain("for (const file of included)");
    expect(src).not.toMatch(/for\s*\(\s*const\s+file\s+of\s+files\s*\)/);
    expect(src).toContain("_pimo_schema_migrations");
  });

  it("015 permanece no repositório (não apagada)", () => {
    const p = path.join(root, "supabase/migrations", FILE_015);
    expect(fs.existsSync(p)).toBe(true);
  });
});

describe("Target / Production guards (inalterados) + redact", () => {
  const STAGING = CANONICAL_PROJECT_REFS.staging;
  const PRODUCTION = CANONICAL_PROJECT_REFS.production;

  it("10: Target Guard staging continua PASS", () => {
    const r = validateMigrateTarget({
      PIMO_MIGRATE_TARGET: "staging",
      SUPABASE_PROJECT_REF: STAGING,
      VITE_SUPABASE_URL: CANONICAL_SUPABASE_URLS.staging,
    });
    expect(r.ok).toBe(true);
  });

  it("11: Production guard continua a exigir confirmação", () => {
    const r = validateMigrateTarget({
      PIMO_MIGRATE_TARGET: "production",
      SUPABASE_PROJECT_REF: PRODUCTION,
      VITE_SUPABASE_URL: CANONICAL_SUPABASE_URLS.production,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("PRODUCTION_CONFIRM_REQUIRED");
  });

  it("12: redactConnectionString não expõe password", () => {
    const redacted = redactConnectionString(
      "postgresql://postgres.abc:SuperSecretPass99@aws-0-eu-central-1.pooler.supabase.com:5432/postgres",
    );
    expect(redacted).not.toContain("SuperSecretPass99");
    expect(redacted).toMatch(/\*\*\*/);
  });
});

describe("lista real de migrations (Phase A)", () => {
  it("com exclude 015, ficheiro real fica EXCLUDED e fora da efectiva", () => {
    const dir = path.join(root, "supabase/migrations");
    const sorted = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    expect(sorted).toContain(FILE_015);

    const { included, excluded } = selectMigrations(sorted, {
      PIMO_MIGRATE_EXCLUDE: FILE_015,
    });
    expect(excluded).toEqual([FILE_015]);
    expect(included).not.toContain(FILE_015);
    expect(included.length).toBe(sorted.length - 1);
  });
});
