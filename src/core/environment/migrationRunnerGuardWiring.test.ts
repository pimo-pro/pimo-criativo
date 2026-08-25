/**
 * Prova estática: runners DB invocam assertMigrateTargetOrExit ANTES de operações de DB.
 * Sem ligação real, sem SQL, sem secrets.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readScript(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

/** Índice da primeira ocorrência relevante (comentários de bloco ignorados de forma simples). */
function firstIndex(src: string, pattern: RegExp): number {
  const m = pattern.exec(src);
  return m ? m.index : -1;
}

function assertGuardBefore(src: string, fileLabel: string, afterPatterns: RegExp[]) {
  const guardIdx = firstIndex(src, /assertMigrateTargetOrExit\s*\(/);
  expect(guardIdx, `${fileLabel}: falta assertMigrateTargetOrExit`).toBeGreaterThanOrEqual(0);

  for (const pat of afterPatterns) {
    const idx = firstIndex(src, pat);
    if (idx < 0) continue;
    expect(
      guardIdx,
      `${fileLabel}: guard deve aparecer antes de ${pat}`,
    ).toBeLessThan(idx);
  }
}

describe("migration runner guard wiring (estático)", () => {
  it("F: applyMigrationsPg — guard antes de connectionCandidates/connectPg/query", () => {
    const src = readScript("scripts/applyMigrationsPg.mjs");
    expect(src).toContain('from "./migrateTargetGuard.mjs"');
    expect(src).toContain('from "./migrateExclude.mjs"');
    assertGuardBefore(src, "applyMigrationsPg", [
      /connectionCandidates\s*\(/,
      /connectPg\s*\(/,
      /\.query\s*\(/,
      /client\.query/,
      /\bBEGIN\b/,
    ]);
  });

  it("F: applySupabaseMigrations — guard antes de link/db push", () => {
    const src = readScript("scripts/applySupabaseMigrations.mjs");
    expect(src).toContain('from "./migrateTargetGuard.mjs"');
    assertGuardBefore(src, "applySupabaseMigrations", [
      /npx supabase link/,
      /npx supabase db push/,
      /execSync\s*\(/,
    ]);
  });

  it("F: validateIndustrialMetadata — guard antes de connect/query", () => {
    const src = readScript("scripts/validateIndustrialMetadata.mjs");
    expect(src).toContain('from "./migrateTargetGuard.mjs"');
    assertGuardBefore(src, "validateIndustrialMetadata", [
      /connectionCandidates\s*\(/,
      /connectPg\s*\(/,
      /\.query\s*\(/,
    ]);
  });

  it("F: regenerateIndustrialWorkOrderNqr — guard antes de spawn/REGEN", () => {
    const src = readScript("scripts/regenerateIndustrialWorkOrderNqr.mjs");
    expect(src).toContain('from "./migrateTargetGuard.mjs"');
    assertGuardBefore(src, "regenerateIndustrialWorkOrderNqr", [
      /spawnSync\s*\(/,
      /REGEN_NQR/,
    ]);
  });
});
