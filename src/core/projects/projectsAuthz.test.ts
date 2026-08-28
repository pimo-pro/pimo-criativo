import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  authzBindProjectOwner,
  authzCanMutateProject,
  authzCanSendToProduction,
  authzCanViewProject,
  authzListIncludesProject,
  type AuthzUser,
} from "./projectsAuthzRules";
import { canUseRemoteProjectsApi, getRemoteApiBearerToken } from "./remoteApiAuth";

function userA(): AuthzUser {
  return {
    id: "user-a",
    username: "Alice",
    role: "pro",
    permissions: ["project.edit.self", "project.view.self"],
  };
}

function userB(): AuthzUser {
  return {
    id: "user-b",
    username: "Bob",
    role: "pro",
    permissions: ["project.edit.self", "project.view.self"],
  };
}

function admin(): AuthzUser {
  return {
    id: "admin-1",
    username: "Admin",
    role: "admin",
    permissions: ["admin.full_access", "project.view.all", "project.edit.self"],
  };
}

describe("Phase 1 — Projects authz / IDOR", () => {
  it("User A pode ver e mutar o próprio projeto", () => {
    const project = { ownerId: "user-a", name: "Meu" };
    expect(authzCanViewProject(userA(), project)).toBe(true);
    expect(authzCanMutateProject(userA(), project)).toBe(true);
  });

  it("User A NÃO pode ver nem mutar o projeto de User B (IDOR)", () => {
    const projectB = { ownerId: "user-b", name: "De Bob" };
    expect(authzCanViewProject(userA(), projectB)).toBe(false);
    expect(authzCanMutateProject(userA(), projectB)).toBe(false);
  });

  it("User B NÃO pode mutar o projeto de User A", () => {
    const projectA = { ownerId: "user-a" };
    expect(authzCanMutateProject(userB(), projectA)).toBe(false);
    expect(authzCanViewProject(userB(), projectA)).toBe(false);
  });

  it("admin pode ver e mutar qualquer projeto", () => {
    const projectB = { ownerId: "user-b" };
    expect(authzCanViewProject(admin(), projectB)).toBe(true);
    expect(authzCanMutateProject(admin(), projectB)).toBe(true);
  });

  it("ownerId no body é sobrescrito pelo JWT (anti-spoof)", () => {
    const bound = authzBindProjectOwner(
      userA(),
      { name: "X", ownerId: "user-b", ownerName: "Hack" },
      null
    );
    expect(bound.ownerId).toBe("user-a");
    expect(bound.ownerName).toBe("Alice");
  });

  it("visitor sem edit.self não cria projetos", () => {
    const visitor: AuthzUser = {
      id: "v1",
      username: "Vis",
      role: "visitor",
      permissions: ["project.view.self"],
    };
    expect(authzCanMutateProject(visitor, null)).toBe(false);
  });

  it("ultra pode enviar à produção; pro não", () => {
    const ultra: AuthzUser = {
      id: "u1",
      username: "Ultra",
      role: "ultra",
      permissions: ["project.edit.self", "project.send_to_production.self"],
    };
    expect(authzCanSendToProduction(ultra)).toBe(true);
    expect(authzCanSendToProduction(userA())).toBe(false);
    expect(authzCanSendToProduction(admin())).toBe(true);
  });

  it("pending não cria projectos", () => {
    const pending: AuthzUser = {
      id: "p1",
      username: "Pend",
      role: "pro",
      accountStatus: "pending",
      permissions: ["project.edit.self", "project.view.self"],
    };
    expect(authzCanMutateProject(pending, null)).toBe(false);
  });

  it("ultra+ vê projectos do admin da plataforma (scope mine expandido)", () => {
    const ultraPlus: AuthzUser = {
      id: "up1",
      username: "UltraPlus",
      role: "ultra+",
      effectiveRole: "ultra+",
      accountStatus: "approved",
      permissions: ["project.edit.self", "project.view.factory"],
    };
    const adminProject = { id: "proj-admin", ownerId: "admin-1" };
    const ctx = { platformAdminId: "admin-1", sharedProjectIds: new Set<string>() };
    expect(authzListIncludesProject(ultraPlus, adminProject, ctx)).toBe(true);
    expect(authzCanViewProject(ultraPlus, adminProject, ctx)).toBe(true);
    expect(authzCanMutateProject(ultraPlus, adminProject, ctx)).toBe(true);
  });

  it("partilha dá acesso ver+editar a projecto alheio", () => {
    const sharedUser: AuthzUser = {
      id: "user-c",
      username: "Carol",
      role: "pro",
      accountStatus: "approved",
      permissions: ["project.edit.self", "project.view.self"],
    };
    const project = { id: "shared-1", ownerId: "user-b" };
    const ctx = { sharedProjectIds: new Set(["shared-1"]) };
    expect(authzListIncludesProject(sharedUser, project, ctx)).toBe(true);
    expect(authzCanMutateProject(sharedUser, project, ctx)).toBe(true);
  });

  it("ultra+ pending não acede projectos do admin", () => {
    const pendingUltraPlus: AuthzUser = {
      id: "up-pending",
      username: "UPend",
      role: "ultra+",
      effectiveRole: "visitor",
      accountStatus: "pending",
      permissions: ["project.view.self"],
    };
    const adminProject = { id: "proj-admin", ownerId: "admin-1" };
    const ctx = { platformAdminId: "admin-1" };
    expect(authzListIncludesProject(pendingUltraPlus, adminProject, ctx)).toBe(false);
  });
});

describe("Phase 1 — remote API auth client", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, String(v));
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
        clear: () => store.clear(),
      },
    });
  });

  afterEach(() => {
    store.clear();
  });

  it("sem token → sem sync remoto", () => {
    expect(getRemoteApiBearerToken()).toBeNull();
    expect(canUseRemoteProjectsApi()).toBe(false);
  });

  it("local-dev-token (K/K) → sem sync remoto", () => {
    localStorage.setItem("pimo_auth_token", "local-dev-token");
    expect(getRemoteApiBearerToken()).toBeNull();
    expect(canUseRemoteProjectsApi()).toBe(false);
  });

  it("JWT real → sync remoto permitido", () => {
    localStorage.setItem("pimo_auth_token", "eyJhbGciOiJIUzI1NiJ9.payload.sig");
    expect(getRemoteApiBearerToken()).toBe("eyJhbGciOiJIUzI1NiJ9.payload.sig");
    expect(canUseRemoteProjectsApi()).toBe(true);
  });
});
