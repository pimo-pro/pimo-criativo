import { useMemo } from "react";
import type { ProjectActions, ProjectSnapshot, SavedProjectInfo } from "../projectTypes";
import {
  captureRoomSnapshot,
  MANUAL_BACKUPS_STORAGE_KEY,
  reviveState,
  serializeState,
  type ManualBackupEntry,
} from "../projectPersistence";
import { safeGetItem, safeParseJson, safeSetItem } from "../../utils/storage";
import { wallStore } from "../../stores/wallStore";
import { applyProjectRoomToWallStore } from "../../3d/viewer-engine/room/RoomEngine";
import { getCurrentProjectUser } from "../../core/projects/currentUser";
import {
  deleteProjectById,
  listProjects,
  loadProjectRecord,
  renameProjectById,
  saveProject,
  saveSnapshot,
} from "../../core/projects/projectsClient";
import { mergeProjectSnapshotsIntoWorkspace } from "../../core/projects/projectMergeWorkspace";
import { defaultState } from "../projectState";
import { devLogger } from "../../utils/devLogger";
import { clearAllCutlistCache } from "../../core/manufacturing/cutlistFromBoxes";
import {
  purgeIndustrialDrillingIfStale,
} from "../../core/manufacturing/industrialProjectDrillingPurge";
import { useToast } from "../../context/ToastContext";
import type { ProjectActionsExecutionContext } from "./projectActionsDeps";

export type ProjectIoActions = Pick<
  ProjectActions,
  | "saveProjectSnapshot"
  | "saveManualBackupSnapshot"
  | "loadProjectSnapshot"
  | "mergeSnapshots"
  | "listSavedProjects"
  | "createNewProject"
  | "setProjectName"
  | "renameProject"
  | "deleteProject"
>;

function logProjectIo(_event: string, _data?: object): void {
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
    devLogger.debug("[ProjectProvider.IO]", _event, _data);
  }
}

export function useProjectIoActions(ctx: ProjectActionsExecutionContext): ProjectIoActions {
  const { updateProject, setProject, viewerSync, undoStackRef, redoStackRef, projectRef, applyResultados } =
    ctx;
  const { showToast } = useToast();

  return useMemo(
    () => ({
      saveProjectSnapshot: () => {
        const snapshot: ProjectSnapshot = {
          projectState: serializeState(projectRef.current),
          viewerSnapshot: viewerSync.saveViewerSnapshot(),
          roomSnapshot: captureRoomSnapshot(),
        };
        const currentUser = getCurrentProjectUser();
        void saveSnapshot({
          name: projectRef.current.projectName?.trim() || "Projeto",
          ownerId: currentUser.ownerId,
          ownerName: currentUser.ownerName,
          snapshot,
          thumbnailDataUrl: null,
        });
      },
      saveManualBackupSnapshot: () => {
        const snapshot: ProjectSnapshot = {
          projectState: serializeState(projectRef.current),
          viewerSnapshot: viewerSync.saveViewerSnapshot(),
          roomSnapshot: captureRoomSnapshot(),
        };
        const savedAt = new Date().toISOString();
        const backup: ManualBackupEntry = {
          id: `backup-${Date.now()}`,
          name: projectRef.current.projectName?.trim() || "Projeto",
          savedAt,
          snapshot,
        };
        const existing = safeParseJson<ManualBackupEntry[]>(safeGetItem(MANUAL_BACKUPS_STORAGE_KEY));
        const next = Array.isArray(existing) ? [backup, ...existing].slice(0, 100) : [backup];
        safeSetItem(MANUAL_BACKUPS_STORAGE_KEY, JSON.stringify(next));
        setProject((prev) => ({ ...prev, lastAutosaveTime: savedAt }));
      },
      loadProjectSnapshot: async (id) => {
        const entry = await loadProjectRecord(id);
        if (!entry) {
          logProjectIo("load-project-miss", { id });
          showToast(
            "Projeto não encontrado. Pode ter sido eliminado ou ainda não sincronizado.",
            "error"
          );
          return;
        }
        viewerSync.restoreViewerSnapshot(
          (entry.snapshot.viewerSnapshot ?? null) as ProjectSnapshot["viewerSnapshot"]
        );
        const restored = reviveState(entry.snapshot.projectState);
        if (!restored) {
          showToast(
            "Snapshot do projeto inválido ou incompatível. Não foi possível abrir.",
            "error"
          );
          return;
        }
        const forceIndustrialPurge =
          (restored.projectName?.trim() ?? "").toLowerCase().includes("antunes");
        const { state: afterPurge, purged, report } = purgeIndustrialDrillingIfStale(restored, {
          force: forceIndustrialPurge,
        });
        if (purged && report) {
          logProjectIo("industrial-drilling-purge", report);
          showToast(
            `Dados industriais regenerados (${report.targetSsot}): ${report.strippedDrillHolesFromExtracted} furos herdados removidos.`,
            "info"
          );
        }
        logProjectIo("project-loaded", { id, boxes: afterPurge.workspaceBoxes?.length ?? 0 });
        if (restored.room) {
          applyProjectRoomToWallStore(restored.room);
        } else if (entry.snapshot.roomSnapshot !== undefined) {
          if (entry.snapshot.roomSnapshot) {
            wallStore
              .getState()
              .loadRoomConfig(entry.snapshot.roomSnapshot as import("../projectTypes").RoomSnapshot);
          } else {
            wallStore.getState().clearRoom();
          }
        }
        clearAllCutlistCache();
        const nextState = applyResultados(afterPurge);
        updateProject(() => ({ ...nextState, currentProjectId: id }));
        if (purged) {
          const snapshot: ProjectSnapshot = {
            projectState: serializeState(nextState),
            viewerSnapshot: (entry.snapshot.viewerSnapshot ??
              null) as ProjectSnapshot["viewerSnapshot"],
            roomSnapshot: (entry.snapshot.roomSnapshot ??
              captureRoomSnapshot()) as ProjectSnapshot["roomSnapshot"],
          };
          const currentUser = getCurrentProjectUser();
          void saveSnapshot({
            localProjectId: id,
            name: nextState.projectName?.trim() || entry.name || "Projeto",
            ownerId: entry.ownerId ?? currentUser.ownerId,
            ownerName: entry.ownerName ?? currentUser.ownerName,
            snapshot,
            thumbnailDataUrl: entry.thumbnailDataUrl ?? null,
          });
        }
      },
      mergeSnapshots: async (ids) => {
        const merged = await mergeProjectSnapshotsIntoWorkspace(ids);
        viewerSync.restoreViewerSnapshot(null);
        wallStore.getState().clearRoom();
        undoStackRef.current = [];
        redoStackRef.current = [];
        clearAllCutlistCache();
        updateProject(() => applyResultados(merged), false);
        logProjectIo("merge-snapshots", { count: ids.length });
      },
      listSavedProjects: async (scope = "mine"): Promise<SavedProjectInfo[]> => {
        const currentUser = getCurrentProjectUser();
        const ownerId = scope === "mine" ? currentUser.ownerId : undefined;
        return listProjects(scope, ownerId);
      },
      setProjectName: (name: string) => {
        updateProject((prev) => ({ ...prev, projectName: name }), true);
      },
      createNewProject: async () => {
        const freshState = applyResultados(defaultState);
        const snapshot: ProjectSnapshot = {
          projectState: serializeState(freshState),
          viewerSnapshot: null,
          roomSnapshot: null,
        };
        const currentUser = getCurrentProjectUser();
        const saved = await saveProject({
          name: freshState.projectName,
          ownerId: currentUser.ownerId,
          ownerName: currentUser.ownerName,
          snapshot,
          thumbnailDataUrl: null,
        });
        if (!saved) return null;

        viewerSync.restoreViewerSnapshot(null);
        wallStore.getState().clearRoom();
        undoStackRef.current = [];
        redoStackRef.current = [];
        clearAllCutlistCache();
        updateProject(() => ({ ...freshState, lastAutosaveTime: saved.updatedAt }), false);
        return saved;
      },
      renameProject: async (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        await renameProjectById(id, { name: trimmed });
      },
      deleteProject: async (id) => {
        await deleteProjectById(id);
      },
    }),
    [updateProject, setProject, viewerSync, undoStackRef, redoStackRef, projectRef, applyResultados, showToast]
  );
}
