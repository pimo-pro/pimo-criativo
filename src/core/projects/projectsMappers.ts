import type {
  PimoProjectData,
  SaveProjectRequest,
  SavedProjectMeta,
  SavedProjectRecord,
} from "./types";
import type { OfflineProjectRecord } from "./projectsOfflineStore";

export function nowIso(): string {
  return new Date().toISOString();
}

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function toIsoOrNow(value: unknown): string {
  if (typeof value !== "string") return nowIso();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? nowIso() : new Date(parsed).toISOString();
}

export function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function projectStateFromSnapshot(snapshot: SaveProjectRequest["snapshot"]): Record<string, unknown> {
  return asObject(snapshot.projectState) ?? {};
}

export function buildPimoProjectDataFromRequest(request: SaveProjectRequest): PimoProjectData {
  const now = new Date().toISOString();
  const state = projectStateFromSnapshot(request.snapshot);
  const stateViewer = asObject(state.viewerSettings);
  const stateMaterials = asObject(state.material);
  const room = request.snapshot.roomSnapshot ?? null;
  const viewerSnapshot = request.snapshot.viewerSnapshot ?? null;
  const boxes = state["workspaceBoxes"] ?? state["boxes"] ?? [];
  const cutlist = safeArray(state["cutList"]);
  const holes = cutlist.flatMap((item) => {
    const row = asObject(item);
    const drill = row ? row["drillHoles"] : null;
    return Array.isArray(drill) ? drill : [];
  });

  const remoteId = (request.remoteProjectId ?? "").trim();
  return {
    id: remoteId,
    name: (request.name ?? "").trim() || (String(state["projectName"] ?? "").trim() || "Projeto"),
    ownerId: request.ownerId,
    ownerName: request.ownerName ?? request.ownerId,
    createdAt: now,
    updatedAt: now,
    room,
    boxes,
    shelves: state["shelves"] ?? [],
    dividers: state["dividers"] ?? [],
    centerDisplay: {
      thumbnailDataUrl: request.thumbnailDataUrl ?? null,
      projectName: state["projectName"] ?? request.name ?? "Projeto",
    },
    holes,
    drillMarkers: state["drillMarkers"] ?? [],
    materials: {
      materialId: state["materialId"] ?? null,
      material: stateMaterials ?? null,
    },
    viewerSnapshot,
    settings: {
      projectState: request.snapshot.projectState,
      viewerSettings: stateViewer ?? null,
      ownerName: request.ownerName ?? request.ownerId,
      thumbnailDataUrl: request.thumbnailDataUrl ?? null,
    },
    thumbnailDataUrl: request.thumbnailDataUrl ?? null,
  };
}

export function toMetaFromProjectData(project: PimoProjectData, index: number): SavedProjectMeta {
  return {
    id: project.id,
    name: project.name,
    sequence: index + 1,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    ownerId: project.ownerId,
    ownerName: project.ownerName ?? project.ownerId,
    thumbnailDataUrl:
      (asObject(project.centerDisplay)?.thumbnailDataUrl as string | null | undefined) ??
      project.thumbnailDataUrl ??
      null,
  };
}

function isRoomSnapshotLike(value: unknown): boolean {
  const obj = asObject(value);
  return obj !== null && Array.isArray(obj["walls"]);
}

export function toRecordFromProjectData(project: PimoProjectData): SavedProjectRecord {
  const settingsObj = asObject(project.settings);
  const projectState = settingsObj?.projectState ?? {};
  const roomSnapshot = isRoomSnapshotLike(project.room) ? project.room : null;
  const snapshot = {
    projectState,
    viewerSnapshot: project.viewerSnapshot ?? null,
    roomSnapshot,
  };
  const meta = toMetaFromProjectData(project, 0);
  return {
    ...meta,
    snapshot,
    projectData: project,
  };
}

export function toSavedMetaFromOffline(project: OfflineProjectRecord, index: number): SavedProjectMeta {
  return {
    id: project.remoteId ?? project.id,
    name: project.name,
    sequence: index + 1,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    ownerId: project.ownerId,
    ownerName: project.ownerName,
    thumbnailDataUrl: project.thumbnailDataUrl,
    ...(project.corrupted ? { corrupted: true } : {}),
  };
}

export function toSavedRecordFromOffline(project: OfflineProjectRecord): SavedProjectRecord {
  return {
    id: project.remoteId ?? project.id,
    name: project.name,
    sequence: 1,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    ownerId: project.ownerId,
    ownerName: project.ownerName,
    thumbnailDataUrl: project.thumbnailDataUrl,
    snapshot: project.snapshot,
  };
}

export function buildOfflineFromRemote(record: SavedProjectRecord): OfflineProjectRecord {
  return {
    id: record.id,
    remoteId: record.id,
    name: record.name,
    ownerId: record.ownerId,
    ownerName: record.ownerName,
    createdAt: toIsoOrNow(record.createdAt),
    updatedAt: toIsoOrNow(record.updatedAt),
    thumbnailDataUrl: record.thumbnailDataUrl ?? null,
    snapshot: record.snapshot,
    deleted: false,
    lastSyncedAt: nowIso(),
  };
}
