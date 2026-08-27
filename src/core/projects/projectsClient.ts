import type {
  RenameProjectRequest,
  SaveProjectRequest,
  SavedProjectMeta,
  SavedProjectRecord,
} from "./types";
import {
  remoteDeleteProject,
  remoteListProjects,
  remoteRenameProject,
  type ProjectsApiDeps,
} from "./projectsApi";
import {
  attemptBackgroundProjectRefresh,
  loadProjectFromServerAndMerge,
  mergeRemoteListIntoOffline,
} from "./projectsMerge";
import {
  asObject,
  buildPimoProjectDataFromRequest,
  isOnline,
  makeId,
  nowIso,
  toMetaFromProjectData,
  toRecordFromProjectData,
  toSavedMetaFromOffline,
  toSavedRecordFromOffline,
} from "./projectsMappers";
import {
  compareByUpdatedDesc,
  projectMatchesId,
  readOfflineProjects,
  writeOfflineProjects,
  type OfflineProjectRecord,
} from "./projectsOfflineStore";
import {
  enqueueSyncOperation,
  ensureProjectsSyncStarted,
  getProjectsSyncStatus,
  markDeletedIfNoPending,
  notifyLocalSaveStatus,
  syncQueue,
} from "./projectsSyncEngine";
export type { ProjectsSyncStatus } from "./projectsSyncEngine";
export { getProjectsSyncStatus, subscribeProjectsSyncStatus, syncQueue } from "./projectsSyncEngine";

const projectsApiDeps: ProjectsApiDeps = {
  buildPimoProjectDataFromRequest,
  asObject,
  toMetaFromProjectData,
  toRecordFromProjectData,
  nowIso,
};

export function saveProjectOffline(
  request: SaveProjectRequest,
  source: "project" | "snapshot" = "project"
): SavedProjectRecord {
  ensureProjectsSyncStarted();
  const timestamp = nowIso();
  const projects = readOfflineProjects();

  // UPDATE: se localProjectId é fornecido, atualizar registo existente em vez de criar novo
  if (request.localProjectId) {
    const idx = projects.findIndex(
      (p) => !p.deleted && projectMatchesId(p, request.localProjectId!)
    );
    if (idx >= 0) {
      const existing = projects[idx];
      projects[idx] = {
        ...existing,
        name: request.name?.trim() || existing.name,
        updatedAt: timestamp,
        thumbnailDataUrl:
          request.thumbnailDataUrl !== undefined
            ? (request.thumbnailDataUrl ?? null)
            : existing.thumbnailDataUrl,
        snapshot: request.snapshot,
      };
      writeOfflineProjects(projects);
      void source;
      notifyLocalSaveStatus(existing.id);
      return toSavedRecordFromOffline(projects[idx]);
    }
  }

  // INSERT: criar novo registo
  const id = makeId("local");
  const record: OfflineProjectRecord = {
    id,
    remoteId: null,
    name: request.name?.trim() || "Projeto",
    ownerId: request.ownerId,
    ownerName: request.ownerName ?? request.ownerId,
    createdAt: timestamp,
    updatedAt: timestamp,
    thumbnailDataUrl: request.thumbnailDataUrl ?? null,
    snapshot: request.snapshot,
    deleted: false,
    lastSyncedAt: null,
  };
  projects.push(record);
  writeOfflineProjects(projects);
  void source;
  notifyLocalSaveStatus(record.id);
  return toSavedRecordFromOffline(record);
}

export function saveSnapshotOffline(request: SaveProjectRequest): SavedProjectRecord {
  return saveProjectOffline(request, "snapshot");
}

export function loadProjectsOffline(
  scope: "mine" | "all",
  ownerId?: string
): SavedProjectMeta[] {
  ensureProjectsSyncStarted();
  const seen = new Set<string>();
  const projects = readOfflineProjects()
    .filter((project) => !project.deleted)
    .filter((project) => {
      if (scope !== "mine") return true;
      if (!ownerId) return true;
      return project.ownerId === ownerId;
    })
    .sort(compareByUpdatedDesc)
    .filter((project) => {
      const key = project.remoteId ?? project.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return projects.map((project, index) => toSavedMetaFromOffline(project, index));
}

export async function listProjects(
  scope: "mine" | "all",
  ownerId?: string
): Promise<SavedProjectMeta[]> {
  ensureProjectsSyncStarted();
  const offline = loadProjectsOffline(scope, ownerId);
  if (!isOnline()) {
    getProjectsSyncStatus();
    return offline;
  }
  try {
    const remote = await remoteListProjects(scope, ownerId, projectsApiDeps);
    const merged = await mergeRemoteListIntoOffline(remote, scope, ownerId, loadProjectsOffline);
    void syncQueue();
    return merged;
  } catch {
    return offline;
  }
}

export async function loadProjectRecord(id: string): Promise<SavedProjectRecord | null> {
  ensureProjectsSyncStarted();
  const projects = readOfflineProjects();
  const local = projects.find((project) => !project.deleted && projectMatchesId(project, id)) ?? null;
  if (local) {
    void attemptBackgroundProjectRefresh(local.name.trim() || id, projectsApiDeps);
    return toSavedRecordFromOffline(local);
  }
  if (!isOnline()) return null;
  try {
    return await loadProjectFromServerAndMerge(id, projectsApiDeps);
  } catch {
    return null;
  }
}

/** Timeout do merge remoto no Relatório (R1) — evita abertura bloqueada em rede fraca. */
export const LOAD_PROJECT_RECORD_FRESH_TIMEOUT_MS = 3000;

function withTimeoutOrNull<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      }
    );
  });
}

/**
 * Relatório Final (R1): aguarda merge remoto vs offline (updatedAt),
 * em vez do refresh só em background de loadProjectRecord.
 * Se o remoto falhar, demorar > timeout, ou não existir → offline local.
 * O merge em curso após timeout pode ainda actualizar o cache; o próximo refresh apanha-o.
 */
export async function loadProjectRecordFresh(
  id: string
): Promise<SavedProjectRecord | null> {
  ensureProjectsSyncStarted();
  const fromOffline = (): SavedProjectRecord | null => {
    const projects = readOfflineProjects();
    const local =
      projects.find((p) => !p.deleted && projectMatchesId(p, id)) ?? null;
    return local ? toSavedRecordFromOffline(local) : null;
  };

  if (isOnline()) {
    try {
      const merged = await withTimeoutOrNull(
        loadProjectFromServerAndMerge(id, projectsApiDeps),
        LOAD_PROJECT_RECORD_FRESH_TIMEOUT_MS
      );
      if (merged) return merged;
    } catch (err) {
      console.warn("[pimo] loadProjectRecordFresh remoto falhou:", id, err);
    }
  }
  return fromOffline();
}

export async function saveProject(request: SaveProjectRequest): Promise<SavedProjectMeta | null> {
  ensureProjectsSyncStarted();
  const savedLocal = saveProjectOffline(request);
  enqueueSyncOperation({
    projectId: readOfflineProjects().find((item) => projectMatchesId(item, savedLocal.id))?.id ?? savedLocal.id,
    op: "save",
    payload: { request },
  });
  if (isOnline()) {
    try {
      await syncQueue();
    } catch (err) {
      console.warn("[SYNC] saveProject continuou após erro de sync:", err);
    }
  }
  const localMeta = loadProjectsOffline("all").find((item) => item.id === savedLocal.id);
  return localMeta ?? {
    id: savedLocal.id,
    name: savedLocal.name,
    sequence: 1,
    createdAt: savedLocal.createdAt,
    updatedAt: savedLocal.updatedAt,
    ownerId: savedLocal.ownerId,
    ownerName: savedLocal.ownerName,
    thumbnailDataUrl: savedLocal.thumbnailDataUrl,
  };
}

export async function renameProjectById(id: string, body: RenameProjectRequest): Promise<boolean> {
  ensureProjectsSyncStarted();
  const projects = readOfflineProjects();
  const idx = projects.findIndex((project) => projectMatchesId(project, id));
  if (idx >= 0) {
    projects[idx] = {
      ...projects[idx],
      name: body.name.trim() || projects[idx].name,
      updatedAt: nowIso(),
    };
    writeOfflineProjects(projects);
    enqueueSyncOperation({
      projectId: projects[idx].id,
      op: "rename",
      payload: { body },
    });
    if (isOnline()) {
      await syncQueue();
    }
    return true;
  }
  if (!isOnline()) return false;
  const ok = await remoteRenameProject(id, body);
  if (ok) {
    void syncQueue();
  }
  return ok;
}

export async function deleteProjectById(id: string): Promise<boolean> {
  ensureProjectsSyncStarted();
  const projects = readOfflineProjects();
  const idx = projects.findIndex((project) => projectMatchesId(project, id));
  if (idx >= 0) {
    const project = projects[idx];
    projects[idx] = {
      ...project,
      deleted: true,
      updatedAt: nowIso(),
    };
    writeOfflineProjects(projects);
    enqueueSyncOperation({
      projectId: project.id,
      op: "delete",
      payload: {},
    });
    if (isOnline()) {
      await syncQueue();
    }
    markDeletedIfNoPending(project.id);
    return true;
  }
  if (!isOnline()) return false;
  const ok = await remoteDeleteProject(id);
  if (ok) {
    void syncQueue();
  }
  return ok;
}

export async function saveSnapshot(request: SaveProjectRequest): Promise<SavedProjectMeta | null> {
  ensureProjectsSyncStarted();
  const savedLocal = saveSnapshotOffline(request);
  enqueueSyncOperation({
    projectId: readOfflineProjects().find((item) => projectMatchesId(item, savedLocal.id))?.id ?? savedLocal.id,
    op: "snapshot",
    payload: { request },
  });
  if (isOnline()) {
    try {
      await syncQueue();
    } catch (err) {
      console.warn("[SYNC] saveSnapshot continuou após erro de sync:", err);
    }
  }
  return loadProjectsOffline("all").find((item) => item.id === savedLocal.id) ?? null;
}

// Aliases explícitos para serviços/hooks que usam nomes semânticos.
export const fetchProjects = listProjects;
export const createProject = saveProject;
export const updateProject = renameProjectById;
export const deleteProject = deleteProjectById;
export const saveDesign = saveProject;
export const loadDesign = loadProjectRecord;

/**
 * Lista todos os projetos do sistema para administradores.
 * Combina dados locais (offline) com dados remotos (scope=all).
 * Deduplicação por id interno garantida pelo mergeRemoteListIntoOffline.
 * Destinada a uso em páginas/ferramentas de administração globais.
 */
export async function listAllProjectsForAdmin(): Promise<SavedProjectMeta[]> {
  return listProjects("all", undefined);
}
