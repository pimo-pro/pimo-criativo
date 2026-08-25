/**
 * Regressão de segurança Phase 1 — verifica no código-fonte PHP
 * que os controlos ACL/IDOR estão presentes (sem PHP CLI).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../..");

function read(rel: string): string {
  return readFileSync(resolve(root, rel), "utf8");
}

describe("Phase 1 — PHP source ACL regression", () => {
  it("authz helpers existem e rejeitam local-dev-token", () => {
    const src = read("api/authz/resourceAccess.php");
    expect(src).toContain("function pimo_authz_require_jwt_user");
    expect(src).toContain("function pimo_authz_can_view_project");
    expect(src).toContain("function pimo_authz_can_mutate_project");
    expect(src).toContain("function pimo_authz_bind_project_owner");
    expect(src).toContain("pimo_is_local_dev_bearer");
    expect(src).toContain("Não autenticado");
  });

  it("Projects API (hostinger) exige JWT e ownership", () => {
    const src = read("hostinger/api/projects/index.php");
    expect(src).toContain("pimo_authz_require_jwt_user");
    expect(src).toContain("pimo_authz_can_view_project");
    expect(src).toContain("pimo_authz_can_mutate_project");
    expect(src).toContain("pimo_authz_bind_project_owner");
    expect(src).toContain("pimo_authz_can_view_all_projects");
    expect(src).not.toContain('Access-Control-Allow-Origin: *');
  });

  it("Projects list.php exige JWT e ignora ownerId do cliente", () => {
    const src = read("hostinger/api/projects/list.php");
    expect(src).toContain("pimo_authz_require_jwt_user");
    expect(src).toContain('$ownerId = (string) $authUser["id"]');
    expect(src).toContain("pimo_authz_can_view_all_projects");
  });

  it("public_html projects está alinhado com hostinger (markers ACL)", () => {
    const a = read("hostinger/api/projects/index.php");
    const b = read("public_html/api/projects/index.php");
    expect(b).toContain("pimo_authz_require_jwt_user");
    expect(b).toContain("pimo_authz_bind_project_owner");
    expect(a.includes("pimo_authz_can_view_project")).toBe(true);
    expect(b.includes("pimo_authz_can_view_project")).toBe(true);
  });

  it("Industrial orders exige JWT + send_to_production", () => {
    const src = read("api/industrial/orders/index.php");
    expect(src).toContain("pimo_authz_require_jwt_user");
    expect(src).toContain("pimo_authz_can_send_to_production");
    expect(src).toContain("'ownerId' => (string) $authUser['id']");
    expect(src).not.toContain("Access-Control-Allow-Origin: *");
  });

  it("Migration 015 revoga policies anon da 013", () => {
    const src = read("supabase/migrations/015_revoke_industrial_anon_write.sql");
    expect(src).toContain('DROP POLICY IF EXISTS "anon write');
    expect(src).toContain('DROP POLICY IF EXISTS "anon read');
    expect(src).toContain("industrial_work_orders");
    expect(src).toContain("industrial_piece_transforms");
  });

  it("Deploy copia authz para dist/_impl", () => {
    const src = read("scripts/copyDeployApiToDist.mjs");
    expect(src).toContain("_impl");
    expect(src).toContain("authz");
    expect(src).toContain("resourceAccess.php");
  });
});
