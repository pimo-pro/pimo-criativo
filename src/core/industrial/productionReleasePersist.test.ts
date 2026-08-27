import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveProductionRelease } from "./productionReleasePersist";
import type { ProductionRelease } from "./productionRelease";

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.payload.sig";

function sampleRelease(): ProductionRelease {
  return {
    version: 1,
    generatedAt: "2026-08-27T10:00:00.000Z",
    projectId: "pimo-antunes",
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
    id: "pimo-antunes",
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
      projectReport: { projectId: "pimo-antunes", version: 2 },
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
    await expect(saveProductionRelease("pimo-antunes", sampleRelease())).rejects.toThrow(
      /Sessão remota/i
    );
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

    await saveProductionRelease("pimo-antunes", release);

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
