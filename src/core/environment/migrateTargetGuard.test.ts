import { describe, expect, it } from "vitest";
import {
  CANONICAL_PROJECT_REFS,
  CANONICAL_SUPABASE_URLS,
  normalizeMigrateTarget,
  projectRefFromDatabaseUrl,
  projectRefFromSupabaseUrl,
  redactConnectionString,
  resolveActualProjectRef,
  resolveExpectedProjectRef,
  validateMigrateTarget,
} from "../../../scripts/migrateTargetGuard.mjs";

const STAGING = CANONICAL_PROJECT_REFS.staging;
const PRODUCTION = CANONICAL_PROJECT_REFS.production;

describe("migrateTargetGuard — canonical allowlist", () => {
  it("A: TARGET=staging + staging ref → PASS", () => {
    const r = validateMigrateTarget({
      PIMO_MIGRATE_TARGET: "staging",
      SUPABASE_PROJECT_REF: STAGING,
      VITE_SUPABASE_URL: CANONICAL_SUPABASE_URLS.staging,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.target).toBe("staging");
      expect(r.actualRef).toBe(STAGING);
    }
  });

  it("B: TARGET=staging + production ref → FAIL", () => {
    const r = validateMigrateTarget({
      PIMO_MIGRATE_TARGET: "staging",
      SUPABASE_PROJECT_REF: PRODUCTION,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("REF_MISMATCH");
  });

  it("C: TARGET=production + staging ref → FAIL", () => {
    const r = validateMigrateTarget({
      PIMO_MIGRATE_TARGET: "production",
      SUPABASE_PROJECT_REF: STAGING,
      CONFIRM_PRODUCTION_MIGRATE: "I_UNDERSTAND",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("REF_MISMATCH");
  });

  it("D: TARGET=production + production ref sem confirmação → FAIL", () => {
    const r = validateMigrateTarget({
      PIMO_MIGRATE_TARGET: "production",
      SUPABASE_PROJECT_REF: PRODUCTION,
      VITE_SUPABASE_URL: CANONICAL_SUPABASE_URLS.production,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("PRODUCTION_CONFIRM_REQUIRED");
  });

  it("E: Project Ref desconhecido → FAIL", () => {
    const r = validateMigrateTarget({
      PIMO_MIGRATE_TARGET: "staging",
      SUPABASE_PROJECT_REF: "abcdefghijklmnopqr",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("REF_MISMATCH");
  });

  it("F: Project Ref ausente → FAIL", () => {
    const r = validateMigrateTarget({
      PIMO_MIGRATE_TARGET: "staging",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("MISSING_ACTUAL_REF");
  });

  it("G: Supabase URL staging + production ref → FAIL", () => {
    const r = validateMigrateTarget({
      PIMO_MIGRATE_TARGET: "production",
      SUPABASE_PROJECT_REF: PRODUCTION,
      VITE_SUPABASE_URL: CANONICAL_SUPABASE_URLS.staging,
      CONFIRM_PRODUCTION_MIGRATE: "I_UNDERSTAND",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(["URL_REF_MISMATCH", "INCONSISTENT_IDENTITY"]).toContain(r.code);
    }
  });

  it("H: Supabase URL production + staging target → FAIL", () => {
    const r = validateMigrateTarget({
      PIMO_MIGRATE_TARGET: "staging",
      SUPABASE_PROJECT_REF: STAGING,
      VITE_SUPABASE_URL: CANONICAL_SUPABASE_URLS.production,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(["URL_REF_MISMATCH", "INCONSISTENT_IDENTITY"]).toContain(r.code);
    }
  });

  it("I: Target ausente → FAIL", () => {
    const r = validateMigrateTarget({
      SUPABASE_PROJECT_REF: STAGING,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("MISSING_TARGET");
  });

  it("J: Target inválido → FAIL", () => {
    expect(normalizeMigrateTarget("prod")).toBeNull();
    const r = validateMigrateTarget({
      PIMO_MIGRATE_TARGET: "prod",
      SUPABASE_PROJECT_REF: STAGING,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("MISSING_TARGET");
  });
});

describe("migrateTargetGuard — extras", () => {
  it("production com confirmação correcta → PASS", () => {
    const r = validateMigrateTarget({
      PIMO_MIGRATE_TARGET: "production",
      SUPABASE_PROJECT_REF: PRODUCTION,
      VITE_SUPABASE_URL: CANONICAL_SUPABASE_URLS.production,
      CONFIRM_PRODUCTION_MIGRATE: "I_UNDERSTAND",
    });
    expect(r.ok).toBe(true);
  });

  it("LOCAL não pode usar ref staging/production", () => {
    const r = validateMigrateTarget({
      PIMO_MIGRATE_TARGET: "local",
      PIMO_SUPABASE_PROJECT_REF_LOCAL: STAGING,
      SUPABASE_PROJECT_REF: STAGING,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("LOCAL_FORBIDDEN_REMOTE_REF");
  });

  it("LOCAL válido com ref dedicado", () => {
    const r = validateMigrateTarget({
      PIMO_MIGRATE_TARGET: "local",
      PIMO_SUPABASE_PROJECT_REF_LOCAL: "locallocal12345678",
      SUPABASE_PROJECT_REF: "locallocal12345678",
    });
    expect(r.ok).toBe(true);
  });

  it("env allowlist conflict staging", () => {
    const r = validateMigrateTarget({
      PIMO_MIGRATE_TARGET: "staging",
      PIMO_SUPABASE_PROJECT_REF_STAGING: PRODUCTION,
      SUPABASE_PROJECT_REF: STAGING,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ENV_ALLOWLIST_CONFLICT");
  });

  it("DATABASE_URL ref consensus", () => {
    expect(
      projectRefFromDatabaseUrl(
        `postgresql://postgres:__FIXTURE_NONEMPTY__@db.${STAGING}.supabase.co:5432/postgres`,
      ),
    ).toBe(STAGING);
    const r = validateMigrateTarget({
      PIMO_MIGRATE_TARGET: "staging",
      DATABASE_URL: `postgresql://postgres:__FIXTURE_NONEMPTY__@db.${STAGING}.supabase.co:5432/postgres`,
      VITE_SUPABASE_URL: CANONICAL_SUPABASE_URLS.staging,
    });
    expect(r.ok).toBe(true);
  });

  it("inconsistent DATABASE_URL vs SUPABASE_PROJECT_REF → FAIL", () => {
    const r = validateMigrateTarget({
      PIMO_MIGRATE_TARGET: "staging",
      SUPABASE_PROJECT_REF: STAGING,
      DATABASE_URL: `postgresql://postgres:__FIXTURE_NONEMPTY__@db.${PRODUCTION}.supabase.co:5432/postgres`,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("INCONSISTENT_IDENTITY");
  });

  it("redactConnectionString remove password", () => {
    const red = redactConnectionString(
      "postgresql://postgres:__FIXTURE_REDACT__@db.example.supabase.co:5432/postgres?sslmode=require",
    );
    expect(red).not.toContain("__FIXTURE_REDACT__");
    expect(red).toContain("***");
  });

  it("resolveExpected é canónico para staging/production", () => {
    expect(resolveExpectedProjectRef("staging", {})).toBe(STAGING);
    expect(resolveExpectedProjectRef("production", {})).toBe(PRODUCTION);
  });

  it("projectRefFromSupabaseUrl", () => {
    expect(projectRefFromSupabaseUrl(CANONICAL_SUPABASE_URLS.staging)).toBe(
      STAGING,
    );
    expect(resolveActualProjectRef({})).toBe("");
  });
});
