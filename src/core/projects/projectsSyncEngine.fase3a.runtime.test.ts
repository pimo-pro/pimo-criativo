/**
 * Fase 3A — evidência runtime do contrato CORRECTO de sync save.
 * Casos http_error / malformed_response: fila permanece, retries++, state=error
 * (mesmo caminho que falha de rede). Caso disabled: remove da fila (intencional).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function installMemoryLocalStorage(): Map<string, string> {
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
  return store;
}

const minimalSnapshot = {
  version: 1,
  boxes: [],
  workspaceBoxes: [],
} as unknown as import("./types").SaveProjectRequest["snapshot"];

describe("Fase 3A — sync save: falhas reais permanecem na fila", () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    localStorage.setItem("pimo_auth_token", "fase3a-runtime-jwt");
    vi.stubGlobal("navigator", { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("HTTP 500 no POST: fila permanece, retries=1, status error, lastSyncedAt intacto", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ status: "error", message: "forced-500" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { writeOfflineProjects, readSyncQueue, readOfflineProjects } = await import(
      "./projectsOfflineStore"
    );
    const {
      enqueueSyncOperation,
      syncQueue,
      getProjectsSyncStatus,
      hasPendingOperation,
    } = await import("./projectsSyncEngine");

    const projectId = "local-fase3a-proj-1";
    const createdAt = "2026-08-01T10:00:00.000Z";
    writeOfflineProjects([
      {
        id: projectId,
        remoteId: null,
        name: "Fase3A Runtime",
        ownerId: "owner-a",
        ownerName: "Owner A",
        createdAt,
        updatedAt: createdAt,
        thumbnailDataUrl: null,
        snapshot: minimalSnapshot,
        deleted: false,
        lastSyncedAt: null,
      },
    ]);

    enqueueSyncOperation({
      projectId,
      op: "save",
      payload: {
        request: {
          name: "Fase3A Runtime",
          ownerId: "owner-a",
          ownerName: "Owner A",
          snapshot: minimalSnapshot,
          thumbnailDataUrl: null,
        },
      },
    });

    expect(readSyncQueue()).toHaveLength(1);
    expect(hasPendingOperation(projectId)).toBe(true);

    await syncQueue();

    const afterQueue = readSyncQueue();
    const afterProjects = readOfflineProjects();
    const status = getProjectsSyncStatus();

    expect(fetchMock).toHaveBeenCalled();
    expect(afterQueue).toHaveLength(1);
    expect(afterQueue[0].retries).toBe(1);
    expect(afterQueue[0].lastError).toMatch(/Falha HTTP ao guardar projeto \(500\)/);
    expect(hasPendingOperation(projectId)).toBe(true);

    expect(status.pending).toBe(1);
    expect(status.state).toBe("error");
    expect(status.hasActiveSyncError).toBe(true);
    expect(status.message).toBe("Erro ao sincronizar");

    expect(afterProjects).toHaveLength(1);
    expect(afterProjects[0].lastSyncedAt).toBeNull();
    expect(afterProjects[0].remoteId).toBeNull();
  });

  it("fetch throw (rede): entrada permanece na fila com retries++ e estado error", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );

    const { writeOfflineProjects, writeSyncQueue, readSyncQueue } = await import(
      "./projectsOfflineStore"
    );
    const { enqueueSyncOperation, syncQueue, getProjectsSyncStatus } = await import(
      "./projectsSyncEngine"
    );

    const projectId = "local-fase3a-proj-2";
    writeOfflineProjects([
      {
        id: projectId,
        remoteId: null,
        name: "Fase3A Network",
        ownerId: "owner-b",
        ownerName: "Owner B",
        createdAt: "2026-08-01T11:00:00.000Z",
        updatedAt: "2026-08-01T11:00:00.000Z",
        thumbnailDataUrl: null,
        snapshot: minimalSnapshot,
        deleted: false,
        lastSyncedAt: null,
      },
    ]);
    writeSyncQueue([]);
    enqueueSyncOperation({
      projectId,
      op: "save",
      payload: {},
    });

    expect(readSyncQueue()).toHaveLength(1);
    await syncQueue();

    const after = readSyncQueue();
    const status = getProjectsSyncStatus();
    expect(after).toHaveLength(1);
    expect(after[0].retries).toBe(1);
    expect(after[0].lastError).toMatch(/Failed to fetch/i);
    expect(status.hasActiveSyncError).toBe(true);
    expect(status.state).toBe("error");
    expect(status.pending).toBe(1);
  });

  it("resposta 200 sem project: permanece na fila com retries++ e status error", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ status: "ok" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
      )
    );

    const { writeOfflineProjects, readSyncQueue, readOfflineProjects } = await import(
      "./projectsOfflineStore"
    );
    const { enqueueSyncOperation, syncQueue, getProjectsSyncStatus } = await import(
      "./projectsSyncEngine"
    );

    const projectId = "local-fase3a-proj-3";
    const lastSyncedAt = "2026-07-01T00:00:00.000Z";
    writeOfflineProjects([
      {
        id: projectId,
        remoteId: "remote-already",
        name: "Fase3A Empty Body",
        ownerId: "owner-c",
        ownerName: "Owner C",
        createdAt: "2026-08-01T12:00:00.000Z",
        updatedAt: "2026-08-01T12:00:00.000Z",
        thumbnailDataUrl: null,
        snapshot: minimalSnapshot,
        deleted: false,
        lastSyncedAt,
      },
    ]);
    enqueueSyncOperation({
      projectId,
      op: "snapshot",
      payload: {},
    });

    await syncQueue();

    const after = readSyncQueue();
    const status = getProjectsSyncStatus();
    expect(after).toHaveLength(1);
    expect(after[0].retries).toBe(1);
    expect(after[0].lastError).toMatch(/Resposta inválida ao guardar projeto/);
    expect(status.state).toBe("error");
    expect(status.hasActiveSyncError).toBe(true);
    expect(status.pending).toBe(1);
    expect(readOfflineProjects()[0].lastSyncedAt).toBe(lastSyncedAt);
    expect(readOfflineProjects()[0].remoteId).toBe("remote-already");
  });
});
