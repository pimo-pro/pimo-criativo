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

  it("Dashboard e Partilhas usam o cliente canónico de projetos", () => {
    const dashboard = readFileSync(
      resolve(__dirname, "../../pages/DashboardPage.tsx"),
      "utf8"
    );
    const shares = readFileSync(
      resolve(__dirname, "../../pages/admin/ProjectSharesAdminPage.tsx"),
      "utf8"
    );

    expect(dashboard).not.toContain('../api/projectsApi');
    expect(dashboard).toContain("canViewAllProjects(hasPermission)");
    expect(shares).toContain('listProjects("all")');
    expect(shares).not.toContain('apiClient.get');
  });
});
