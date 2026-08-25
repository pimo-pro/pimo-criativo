/**
 * Regressão UI Phase 1 — gate /admin no App.tsx.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Phase 1 — Admin UI gate source", () => {
  it("LegacyApp bloqueia /admin sem sessão ou sem permission", () => {
    const src = readFileSync(resolve(__dirname, "../../App.tsx"), "utf8");
    expect(src).toContain('Navigate to="/login"');
    expect(src).toContain('from: "/admin"');
    expect(src).toContain("canAccessAdminPanel(hasPermission)");
    expect(src).toContain('path="/admin/settings/industrial"');
    expect(src).toMatch(
      /path="\/admin\/settings\/industrial"[\s\S]*PermissionRoute check=\{canAccessAdminPanel\}/
    );
  });
});
