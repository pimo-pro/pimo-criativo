import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadProductionRelease,
  outboxMatchesProjectKey,
  persistProductionReleaseBeforeRedirect,
  PRODUCTION_RELEASE_OUTBOX_KEY,
  PRODUCTION_RELEASE_REDIRECT_BUDGET_MS,
  saveProductionRelease,
  scheduleProductionReleasePersist,
  type ProductionReleaseOutboxItem,
} from "./productionReleasePersist";
import type { ProductionRelease } from "./productionRelease";

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.payload.sig";

function sampleRelease(projectId = "pimo-00f1f73d1f0424ed"): ProductionRelease {
  return {
    version: 1,
    generatedAt: "2026-08-27T10:00:00.000Z",
    projectId,
    chapas: {
      totalSheets: 1,
      totalWasteMm2: 0,
      totalWastePct: 0,
      sheets: [],
      mode: "oficial_pro",
      diagnostics: ["origem=oficial_pro"],
    },
    ferragens: { totalEur: 0, totalQty: 0, lines: [] },
  };
}

function remoteProjectPayload() {
  return {
    id: "pimo-00f1f73d1f0424ed",
    name: "Antunes Novo Cozinha",
    ownerId: "user-1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-26T00:00:00.000Z",
    room: null,
    boxes: [],
    shelves: [],
    dividers: [],
    centerDisplay: null,
    holes: [],
    drillMarkers: [],
    materials: [],
    viewerSnapshot: null,
    settings: {
      projectReport: { projectId: "pimo-00f1f73d1f0424ed", version: 2 },
    },
  };
}

describe("saveProductionRelease", () => {
  const store = new Map<string, string>();
  const fetchMock = vi.fn();

  beforeEach(() => {
    store.clear();
    fetchMock.mockReset();
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
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sem token: não faz POST", async () => {
    await expect(
      saveProductionRelease("pimo-00f1f73d1f0424ed", sampleRelease())
    ).rejects.toThrow(/Sessão remota/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("GET-merge-POST: grava productionRelease e preserva projectReport", async () => {
    store.set("pimo_auth_token", TOKEN);
    const remote = remoteProjectPayload();
    const release = sampleRelease();

    fetchMock.mockImplementation(async (_url: unknown, init?: RequestInit) => {
      const method = String(init?.method || "GET").toUpperCase();
      if (method === "POST") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: "ok", project: remote }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: "ok", project: remote }),
      };
    });

    await saveProductionRelease("pimo-00f1f73d1f0424ed", release);

    const postCall = fetchMock.mock.calls.find((c) => {
      const init = c[1] as RequestInit | undefined;
      return String(init?.method || "").toUpperCase() === "POST";
    });
    expect(postCall).toBeTruthy();
    const body = JSON.parse(String((postCall![1] as RequestInit).body));
    expect(body.settings.productionRelease.version).toBe(1);
    expect(body.settings.projectReport.version).toBe(2);
  });
});

describe("outbox matchKeys (P3)", () => {
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
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({ status: "error" }),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("outboxMatchesProjectKey: pimo-id + alias slug casa com leitura por slug", () => {
    const release = sampleRelease("pimo-00f1f73d1f0424ed");
    const item: ProductionReleaseOutboxItem = {
      projectId: "pimo-00f1f73d1f0424ed",
      release,
      matchKeys: [
        "pimo-00f1f73d1f0424ed",
        "Antunes_Novo_Cozinha",
        "Antunes Novo Cozinha",
      ],
    };
    expect(outboxMatchesProjectKey(item, "Antunes_Novo_Cozinha")).toBe(true);
    expect(outboxMatchesProjectKey(item, "pimo-00f1f73d1f0424ed")).toBe(true);
    expect(outboxMatchesProjectKey(item, "Outro_Projeto")).toBe(false);
  });

  it("loadProductionRelease: outbox gravado com pimo-id + alias casa na leitura por slug", async () => {
    const release = sampleRelease("pimo-00f1f73d1f0424ed");
    scheduleProductionReleasePersist("pimo-00f1f73d1f0424ed", release, {
      aliasKeys: ["Antunes_Novo_Cozinha", "Antunes Novo Cozinha"],
      saveRelease: async () => {
        throw new Error("offline simulado");
      },
    });

    expect(store.get(PRODUCTION_RELEASE_OUTBOX_KEY)).toBeTruthy();

    const loaded = await loadProductionRelease("Antunes_Novo_Cozinha");
    expect(loaded).not.toBeNull();
    expect(loaded?.projectId).toBe("pimo-00f1f73d1f0424ed");
    expect(loaded?.generatedAt).toBe(release.generatedAt);
  });
});

describe("persistProductionReleaseBeforeRedirect (P2)", () => {
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
    vi.useRealTimers();
  });

  it("save OK dentro do budget: limpa outbox; sem toast", async () => {
    const toasts: string[] = [];
    await persistProductionReleaseBeforeRedirect("pimo-x", sampleRelease("pimo-x"), {
      budgetMs: 500,
      aliasKeys: ["Slug_X"],
      showToast: (t) => toasts.push(t),
      saveRelease: async () => {
        /* ok */
      },
    });
    expect(store.get(PRODUCTION_RELEASE_OUTBOX_KEY)).toBeUndefined();
    expect(toasts).toHaveLength(0);
  });

  it("timeout: devolve sem toast bloqueante; outbox mantém-se para drain", async () => {
    vi.useFakeTimers();
    const toasts: Array<{ text: string; type?: string }> = [];

    const pending = persistProductionReleaseBeforeRedirect("pimo-x", sampleRelease("pimo-x"), {
      budgetMs: PRODUCTION_RELEASE_REDIRECT_BUDGET_MS,
      showToast: (text, type) => toasts.push({ text, type }),
      saveRelease: () => new Promise(() => {
        /* pendente para sempre */
      }),
    });

    await vi.advanceTimersByTimeAsync(PRODUCTION_RELEASE_REDIRECT_BUDGET_MS);
    await pending;

    expect(store.get(PRODUCTION_RELEASE_OUTBOX_KEY)).toBeTruthy();
    expect(toasts).toHaveLength(0);
  });
});
