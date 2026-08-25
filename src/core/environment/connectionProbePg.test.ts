import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertStagingDbPasswordEmpty } from "../../../scripts/connectionProbePg.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const workflowPath = path.join(root, ".github/workflows/supabase-migrations.yml");
const probePath = path.join(root, "scripts/connectionProbePg.mjs");

describe("connectionProbePg — staging password guard", () => {
  it("FAIL se staging com SUPABASE_DB_PASSWORD preenchido", () => {
    const r = assertStagingDbPasswordEmpty({
      PIMO_MIGRATE_TARGET: "staging",
      SUPABASE_DB_PASSWORD: "should-not-be-here",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("STAGING_PASSWORD_FORBIDDEN");
  });

  it("PASS se staging com password vazio", () => {
    expect(
      assertStagingDbPasswordEmpty({
        PIMO_MIGRATE_TARGET: "staging",
        SUPABASE_DB_PASSWORD: "",
      }).ok,
    ).toBe(true);
  });

  it("PASS se production com password (não aplica regra staging)", () => {
    expect(
      assertStagingDbPasswordEmpty({
        PIMO_MIGRATE_TARGET: "production",
        SUPABASE_DB_PASSWORD: "prod-password",
      }).ok,
    ).toBe(true);
  });
});

describe("connection-only workflow static", () => {
  const yml = fs.readFileSync(workflowPath, "utf8");
  const probe = fs.readFileSync(probePath, "utf8");

  it("default mode é connection-only", () => {
    expect(yml).toMatch(/default:\s*connection-only/);
  });

  it("jobs mutuamente exclusivos por mode", () => {
    expect(yml).toMatch(
      /connection-only:[\s\S]*?if:\s*\$\{\{\s*github\.event\.inputs\.mode\s*==\s*'connection-only'\s*\}\}/,
    );
    expect(yml).toMatch(
      /migrate:[\s\S]*?if:\s*\$\{\{\s*github\.event\.inputs\.mode\s*==\s*'migrate'\s*\}\}/,
    );
  });

  it("connection-only usa Option A password vazia em staging", () => {
    const connectionBlock = yml.split("connection-only:")[1]?.split("migrate:")[0] ?? "";
    expect(connectionBlock).toContain(
      "github.event.inputs.target != 'staging' && secrets.SUPABASE_DB_PASSWORD || ''",
    );
    expect(connectionBlock).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(connectionBlock).toContain("connectionProbePg.mjs");
  });

  it("probe só executa SELECT 1 e não imprime secrets", () => {
    expect(probe).toContain('SELECT 1 AS ok');
    expect(probe).not.toMatch(/INSERT\s+|UPDATE\s+|DELETE\s+|DROP\s+|CREATE\s+TABLE/i);
    expect(probe).toContain("hostname:");
    expect(probe).not.toContain("console.log(env.DATABASE_URL)");
    expect(probe).not.toContain("console.log(databaseUrl)");
    expect(probe).not.toContain("database_url_redacted");
  });
});
