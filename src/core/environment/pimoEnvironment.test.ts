import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  getDeclaredClientAppEnv,
  isFullLocalDevelopmentAccessEnabled,
  isLocalDevAuthUiAllowed,
  isLocalDevelopmentRuntime,
  normalizePimoAppEnv,
  resolveClientRuntimeKind,
} from "./pimoEnvironment";
import {
  getLocalDevelopmentPermissions,
  hasPermissionWithLocalDevAccess,
} from "./localDevAccess";

describe("pimoEnvironment", () => {
  it("normalizePimoAppEnv fail-closed para valores inválidos", () => {
    expect(normalizePimoAppEnv("")).toBe("production");
    expect(normalizePimoAppEnv("nope")).toBe("production");
    expect(normalizePimoAppEnv("staging")).toBe("staging");
    expect(normalizePimoAppEnv("local")).toBe("local");
  });

  it("em Vitest/DEV resolve local-dev", () => {
    expect(resolveClientRuntimeKind()).toBe("local-dev");
    expect(isLocalDevelopmentRuntime()).toBe(true);
    expect(isFullLocalDevelopmentAccessEnabled()).toBe(true);
    expect(isLocalDevAuthUiAllowed()).toBe(true);
  });

  it("getDeclaredClientAppEnv em DEV sem VITE_PIMO_APP_ENV → local", () => {
    expect(getDeclaredClientAppEnv()).toBe("local");
  });
});

describe("localDevAccess", () => {
  it("getLocalDevelopmentPermissions inclui admin.full_access em DEV", () => {
    const perms = getLocalDevelopmentPermissions();
    expect(perms).toContain("admin.full_access");
    expect(perms).toContain("project.view.all");
    expect(perms.length).toBeGreaterThan(3);
  });

  it("hasPermissionWithLocalDevAccess permite tudo com sessão local-dev", () => {
    const deny = () => false;
    expect(
      hasPermissionWithLocalDevAccess("project.edit.self", deny, {
        localDevSessionActive: true,
      })
    ).toBe(true);
  });

  it("sem sessão local-dev respeita baseHas", () => {
    expect(
      hasPermissionWithLocalDevAccess("project.edit.self", () => false, {
        localDevSessionActive: false,
      })
    ).toBe(false);
    expect(
      hasPermissionWithLocalDevAccess("project.edit.self", (p) => p === "project.edit.self", {
        localDevSessionActive: false,
      })
    ).toBe(true);
  });
});

describe("localDevAccess — produção simulada", () => {
  const originalDev = import.meta.env.DEV;

  beforeEach(() => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_PIMO_APP_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    void originalDev;
  });

  // Nota: import.meta.env.DEV em Vitest pode não ser stubável em todos os setups.
  // Validamos pelo menos o caminho de normalize + hasPermission sem sessão local.
  it("sem sessão local, baseHas continua a ser a autoridade", () => {
    expect(
      hasPermissionWithLocalDevAccess("admin.full_access", () => false, {
        localDevSessionActive: false,
      })
    ).toBe(false);
  });
});
