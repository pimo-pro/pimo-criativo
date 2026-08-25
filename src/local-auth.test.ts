import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function installMemoryLocalStorage(): void {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
  });
}

describe("local-auth Phase 0", () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("tryLocalAuth falha closed se backend rejeitar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ status: "error" }), { status: 403 }))
    );
    const { tryLocalAuth, readLocalAuthSession } = await import("./local-auth");
    // Em vitest (node) import.meta.env.DEV costuma ser true via Vite.
    if (!import.meta.env.DEV) {
      expect(await tryLocalAuth("K", "K")).toBe(false);
      return;
    }
    await expect(tryLocalAuth("K", "K")).resolves.toBe(false);
    expect(readLocalAuthSession()).toBeNull();
  });

  it("tryLocalAuth cria sessão só com backend ok + K/K", async () => {
    if (!import.meta.env.DEV) return;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              status: "ok",
              localDev: true,
              token: "local-dev-token",
              user: { id: "local-user", username: "Khaled Local", role: "industrial" },
            }),
            { status: 200 }
          )
      )
    );
    const { tryLocalAuth, readLocalAuthSession, clearLocalAuthSession } = await import(
      "./local-auth"
    );
    await expect(tryLocalAuth("K", "K")).resolves.toBe(true);
    const session = readLocalAuthSession();
    expect(session?.token).toBe("local-dev-token");
    expect(session?.user.role).toBe("local-dev");
    expect(session?.fullLocalDevAccess).toBe(true);
    expect(session?.permissions).toContain("admin.full_access");
    clearLocalAuthSession();
  });

  it("tryLocalAuth rejeita credenciais que não são K/K", async () => {
    if (!import.meta.env.DEV) return;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { tryLocalAuth } = await import("./local-auth");
    await expect(tryLocalAuth("admin@pimo.local", "admin123")).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
