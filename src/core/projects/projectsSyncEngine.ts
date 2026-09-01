import type { RenameProjectRequest, SaveProjectRequest } from "./types";
import {
  remoteDeleteProject,
  remoteRenameProject,
  remoteSaveProject,
  type ProjectsApiDeps,
} from "./projectsApi";
import { devLogger } from "../../utils/devLogger";
import {
  asObject,
  buildPimoProjectDataFromRequest,
  isOnline,
  nowIso,
  toIsoOrNow,
  toMetaFromProjectData,
  toRecordFromProjectData,
} from "./projectsMappers";
import { getCurrentProjectUser } from "./currentUser";
import {
  migrateLegacyLocalProjectsOnce,
  migrateGenericOwnerIdOnce,
  readOfflineProjects,
  readSyncQueue,
  startIdbInit,
  writeOfflineProjects,
  writeSyncQueue,
  type OfflineProjectRecord,
  type SyncQueueEntry,
} from "./projectsOfflineStore";
import { isIndustrialFileGenerationActive } from "../fabrication/industrialGenerationSuspend";

const SYNC_INTERVAL_MS = 15000;

export type ProjectsSyncStatus = {
  online: boolean;
  pending: number;
  state: "idle" | "saved_local" | "syncing" | "awaiting_network" | "synced" | "error";
  message: string;
  lastSyncAt: string | null;
  hasActiveSyncError: boolean;
  retryInMs: number | null;
};

let syncLoopStarted = false;
let syncInProgress = false;
let syncRetryAttempt = 0;
let nextRetryAtMs = 0;
let retryTimerId: number | null = null;
const syncStatusListeners = new Set<(_status: ProjectsSyncStatus) => void>();
let syncStatus: ProjectsSyncStatus = {
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  pending: 0,
  state: "idle",
  message: "Pronto",
  lastSyncAt: null,
  hasActiveSyncError: false,
  retryInMs: null,
};

const projectsApiDeps: ProjectsApiDeps = {
  buildPimoProjectDataFromRequest,
  asObject,
  toMetaFromProjectData,
  toRecordFromProjectData,
  nowIso,
};

export function hasPendingOperation(projectId: string): boolean {
  return readSyncQueue().some((entry) => entry.projectId === projectId);
}

function setSyncStatus(patch: Partial<ProjectsSyncStatus>): void {
  syncStatus = {
    ...syncStatus,
    ...patch,
    online: isOnline(),
  };
  syncStatusListeners.forEach((listener) => {
    try {
      listener(syncStatus);
    } catch {
      /* ignore */
    }
  });
}

function refreshPendingStatus(): void {
  const pending = readSyncQueue().length;
  if (syncStatus.hasActiveSyncError && pending > 0) {
    const remaining = nextRetryAtMs > 0 ? Math.max(0, nextRetryAtMs - Date.now()) : null;
    setSyncStatus({
      pending,
      state: "error",
      message: "Erro ao sincronizar",
      hasActiveSyncError: true,
      retryInMs: remaining,
    });
    return;
  }
  if (!isOnline() && pending > 0) {
    setSyncStatus({
      pending,
      state: "awaiting_network",
      message: `${pending} operação(ões) pendente(s)`,
      hasActiveSyncError: false,
      retryInMs: null,
    });
    return;
  }
  if (pending === 0) {
    syncRetryAttempt = 0;
    nextRetryAtMs = 0;
    if (retryTimerId != null && typeof window !== "undefined") {
      window.clearTimeout(retryTimerId);
      retryTimerId = null;
    }
    setSyncStatus({
      pending,
      state: "synced",
      message: "Sincronizado",
      hasActiveSyncError: false,
      retryInMs: null,
    });
    return;
  }
  setSyncStatus({
    pending,
    state: "idle",
    message: `${pending} operação(ões) pendente(s)`,
    hasActiveSyncError: false,
    retryInMs: null,
  });
}

function getRetryDelayMs(attempt: number): number {
  if (attempt <= 1) return 60000;
  if (attempt === 2) return 120000;
  if (attempt === 3) return 300000;
  return 600000;
}

function scheduleRetry(delayMs: number): void {
  if (typeof window === "undefined") return;
  if (retryTimerId != null) {
    window.clearTimeout(retryTimerId);
    retryTimerId = null;
  }
  retryTimerId = window.setTimeout(() => {
    retryTimerId = null;
    void syncQueue();
  }, delayMs);
}

export function enqueueSyncOperation(entry: Omit<SyncQueueEntry, "id" | "createdAt" | "updatedAt" | "retries" | "lastError">): void {
  const queue = readSyncQueue();
  queue.push({
    id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    projectId: entry.projectId,
    op: entry.op,
    payload: entry.payload ?? {},
    createdAt: nowIso(),
    updatedAt: nowIso(),
    retries: 0,
    lastError: null,
  });
  writeSyncQueue(queue);
  // Nova operação do utilizador: não deixar backoff de uma falha antiga bloquear POST/PUT/DELETE indefinidamente.
  if (retryTimerId != null && typeof window !== "undefined") {
    window.clearTimeout(retryTimerId);
    retryTimerId = null;
  }
  syncRetryAttempt = 0;
  nextRetryAtMs = 0;
  setSyncStatus({
    pending: queue.length,
    state: isOnline() ? "saved_local" : "awaiting_network",
    message: isOnline() ? "Guardado localmente. A sincronizar..." : "Guardado localmente. Sem internet.",
    hasActiveSyncError: false,
    retryInMs: null,
  });
}

export function markDeletedIfNoPending(projectId: string): void {
  if (hasPendingOperation(projectId)) return;
  const projects = readOfflineProjects();
  const next = projects.filter((p) => p.id !== projectId);
  if (next.length !== projects.length) {
    writeOfflineProjects(next);
  }
}

export function buildSaveRequestFromOffline(project: OfflineProjectRecord): SaveProjectRequest {
  return {
    name: project.name,
    ownerId: project.ownerId,
    ownerName: project.ownerName,
    snapshot: project.snapshot,
    thumbnailDataUrl: project.thumbnailDataUrl,
  };
}

function resolveProjectIdForRemote(project: OfflineProjectRecord): string | null {
  if (project.remoteId && (project.remoteId?.trim()?.length ?? 0) > 0) return project.remoteId;
  if (!project.id.startsWith("local-") && !project.id.startsWith("legacy-")) return project.id;
  return null;
}

function ensureSyncLoopStarted(): void {
  if (syncLoopStarted) return;
  syncLoopStarted = true;
  startIdbInit(); // garantir arranque antecipado do IDB (idempotente)
  migrateLegacyLocalProjectsOnce({
    enqueueSyncOperation,
    buildSaveRequestFromOffline,
  });
  migrateGenericOwnerIdOnce(getCurrentProjectUser);
  if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
      setSyncStatus({ online: true });
      void syncQueue();
    });
    window.addEventListener("offline", () => {
      refreshPendingStatus();
    });
    setInterval(() => {
      void syncQueue();
    }, SYNC_INTERVAL_MS);
    void syncQueue();
  }
}

export function ensureProjectsSyncStarted(): void {
  ensureSyncLoopStarted();
}

export function notifyLocalSaveStatus(projectId: string): void {
  void projectId;
  ensureSyncLoopStarted();
  setSyncStatus({
    state: "saved_local",
    message: "Projeto guardado localmente",
  });
}

export function getProjectsSyncStatus(): ProjectsSyncStatus {
  ensureSyncLoopStarted();
  refreshPendingStatus();
  return syncStatus;
}

export function subscribeProjectsSyncStatus(
  listener: (_status: ProjectsSyncStatus) => void
): () => void {
  ensureSyncLoopStarted();
  syncStatusListeners.add(listener);
  try {
    listener(syncStatus);
  } catch {
    /* ignore */
  }
  return () => {
    syncStatusListeners.delete(listener);
  };
}

export async function syncQueue(): Promise<void> {
  ensureSyncLoopStarted();
  if (isIndustrialFileGenerationActive()) {
    refreshPendingStatus();
    return;
  }
  if (syncInProgress) return;
  if (syncStatus.hasActiveSyncError && nextRetryAtMs > Date.now()) return;
  const queue = readSyncQueue();
  if (queue.length === 0) {
    refreshPendingStatus();
    return;
  }
  if (!isOnline()) {
    refreshPendingStatus();
    return;
  }
  syncInProgress = true;
  setSyncStatus({
    state: "syncing",
    pending: queue.length,
    message: "A sincronizar...",
    retryInMs: null,
  });

  try {
    const projects = readOfflineProjects();
    const nextQueue = [...queue];
    let hadError = false;
    for (let index = 0; index < nextQueue.length; ) {
      const entry = nextQueue[index];
      const projectIdx = projects.findIndex((project) => project.id === entry.projectId);
      const project = projectIdx >= 0 ? projects[projectIdx] : null;
      try {
        if (entry.op === "save" || entry.op === "snapshot") {
          if (!project) {
            nextQueue.splice(index, 1);
            continue;
          }
          const requestObj = asObject(entry.payload.request);
          const baseRequest = requestObj
            ? (requestObj as SaveProjectRequest)
            : buildSaveRequestFromOffline(project);
          const request: SaveProjectRequest = project.remoteId
            ? { ...baseRequest, remoteProjectId: project.remoteId }
            : baseRequest;
          const saveResult = await remoteSaveProject(request, projectsApiDeps);
          if (saveResult.ok === true) {
            const saved = saveResult.meta;
            projects[projectIdx] = {
              ...project,
              remoteId: saved.id,
              name: saved.name,
              ownerId: saved.ownerId,
              ownerName: saved.ownerName,
              updatedAt: toIsoOrNow(saved.updatedAt),
              thumbnailDataUrl: saved.thumbnailDataUrl ?? project.thumbnailDataUrl,
              lastSyncedAt: nowIso(),
              deleted: false,
            };
            nextQueue.splice(index, 1);
            continue;
          }
          if (saveResult.reason === "disabled") {
            // Sync remoto desactivado de propósito — não há destino; remove da fila (comportamento actual).
            nextQueue.splice(index, 1);
            continue;
          }
          // http_error | malformed_response → mesmo caminho que falha de rede (catch abaixo).
          const msg =
            saveResult.reason === "http_error"
              ? `Falha HTTP ao guardar projeto (${saveResult.status})`
              : "Resposta inválida ao guardar projeto";
          throw new Error(msg);
        }

        if (entry.op === "rename") {
          if (!project) {
            nextQueue.splice(index, 1);
            continue;
          }
          const remoteId = resolveProjectIdForRemote(project);
          if (!remoteId) {
            nextQueue.splice(index, 1);
            continue;
          }
          const body = asObject(entry.payload.body) as RenameProjectRequest | null;
          const name = body?.name ?? project.name;
          const ok = await remoteRenameProject(remoteId, { name });
          if (!ok) throw new Error("Falha ao renomear no servidor");
          projects[projectIdx] = { ...project, lastSyncedAt: nowIso(), updatedAt: nowIso() };
          nextQueue.splice(index, 1);
          continue;
        }

        if (entry.op === "delete") {
          if (!project) {
            nextQueue.splice(index, 1);
            continue;
          }
          const remoteId = resolveProjectIdForRemote(project);
          if (remoteId) {
            try {
              const ok = await remoteDeleteProject(remoteId);
              if (!ok) {
                devLogger.warn("[SYNC] Falha ao apagar no servidor; seguindo com fluxo local", { remoteId });
              }
            } catch (deleteErr) {
              devLogger.warn("[SYNC] Erro no delete remoto; seguindo com fluxo local", {
                remoteId,
                error: deleteErr instanceof Error ? deleteErr.message : "erro desconhecido",
              });
            }
          }
          projects.splice(projectIdx, 1);
          nextQueue.splice(index, 1);
          continue;
        }

        nextQueue.splice(index, 1);
      } catch (error) {
        hadError = true;
        nextQueue[index] = {
          ...entry,
          retries: entry.retries + 1,
          updatedAt: nowIso(),
          lastError: error instanceof Error ? error.message : "Erro de sincronização",
        };
        if (!isOnline()) break;
        syncRetryAttempt += 1;
        const delayMs = getRetryDelayMs(syncRetryAttempt);
        nextRetryAtMs = Date.now() + delayMs;
        scheduleRetry(delayMs);
        setSyncStatus({
          pending: nextQueue.length,
          state: "error",
          message: "Erro ao sincronizar",
          hasActiveSyncError: true,
          retryInMs: delayMs,
        });
        break;
      }
    }

    writeOfflineProjects(projects);
    writeSyncQueue(nextQueue);
    const hasPending = nextQueue.length > 0;
    if (!hasPending) {
      syncRetryAttempt = 0;
      nextRetryAtMs = 0;
      if (retryTimerId != null && typeof window !== "undefined") {
        window.clearTimeout(retryTimerId);
        retryTimerId = null;
      }
    }
    const activeError = hasPending ? hadError : false;
    setSyncStatus({
      pending: nextQueue.length,
      state: hasPending ? (activeError ? "error" : "idle") : "synced",
      message: hasPending
        ? (activeError ? "Erro ao sincronizar" : `${nextQueue.length} operação(ões) pendente(s)`)
        : "Sincronizado",
      lastSyncAt: nowIso(),
      hasActiveSyncError: activeError,
      retryInMs: hasPending && activeError
        ? Math.max(0, nextRetryAtMs - Date.now())
        : null,
    });
  } finally {
    syncInProgress = false;
  }
}
