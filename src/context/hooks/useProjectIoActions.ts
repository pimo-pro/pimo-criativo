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
import { applyProjectRoomToWallStore, normalizeProjectRoom, wallStoreToProjectRoom } from "../../3d/viewer-engine/room/RoomEngine";
import { getCurrentProjectUser } from "../../core/projects/currentUser";
import {
  DEFAULT_EMPRESA_EXECUTORA,
  resolveProjectDesigner,
} from "../../core/projects/projectMeta";
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
import { clearIndustrialLiveProject } from "../../core/industrial/onlineAnalysis/industrialLiveProjectStore";
import { useToast } from "../../context/ToastContext";
import type { ProjectActionsExecutionContext } from "./projectActionsDeps";
import { prepareImportedProjectState } from "../../industrial/import/loadImportedPimoProject";

export type ProjectIoActions = Pick<
  ProjectActions,
  | "saveProjectSnapshot"
  | "saveManualBackupSnapshot"
  | "loadProjectSnapshot"
  | "loadImportedPimoProject"
  | "mergeSnapshots"
  | "listSavedProjects"
  | "createNewProject"
  | "setProjectName"
  | "setProjectDesigner"
  | "setEmpresaExecutora"
  | "setMateriaisProjeto"
  | "renameProject"
  | "deleteProject"
  | "applyDesignWorkspaceState"
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
          roomSnapshot: captureRoomSnapshot(projectRef.current.room),
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
          roomSnapshot: captureRoomSnapshot(projectRef.current.room),
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
        let restored = reviveState(entry.snapshot.projectState);
        if (!restored) {
          showToast(
            "Snapshot do projeto inválido ou incompatível. Não foi possível abrir.",
            "error"
          );
          return;
        }
        logProjectIo("project-loaded", { id, boxes: restored.workspaceBoxes?.length ?? 0 });
        if (restored.room) {
          applyProjectRoomToWallStore(restored.room);
        } else if (entry.snapshot.roomSnapshot) {
          const rs = entry.snapshot.roomSnapshot as import("../projectTypes").RoomSnapshot;
          const promoted = rs.walls?.length ? wallStoreToProjectRoom(rs.walls) : null;
          const normalized = promoted ? normalizeProjectRoom(promoted) : null;
          if (normalized) {
            restored = { ...restored, room: normalized };
            applyProjectRoomToWallStore(normalized);
          } else {
            wallStore.getState().loadRoomConfig(rs);
          }
        } else if (entry.snapshot.roomSnapshot === null) {
          wallStore.getState().clearRoom();
        }
        clearAllCutlistCache();
        clearIndustrialLiveProject();
        updateProject(() => ({ ...applyResultados(restored), currentProjectId: id }));
      },
      loadImportedPimoProject: async (snapshot, projectNameSlug) => {
        let restored = prepareImportedProjectState(snapshot.projectState);
        if (!restored) {
          showToast("Ficheiro de projeto inválido ou incompatível.", "error");
          return;
        }
        viewerSync.restoreViewerSnapshot(
          (snapshot.viewerSnapshot ?? null) as ProjectSnapshot["viewerSnapshot"]
        );
        if (restored.room) {
          applyProjectRoomToWallStore(restored.room);
        } else if (snapshot.roomSnapshot) {
          const rs = snapshot.roomSnapshot as import("../projectTypes").RoomSnapshot;
          const promoted = rs.walls?.length ? wallStoreToProjectRoom(rs.walls) : null;
          const normalized = promoted ? normalizeProjectRoom(promoted) : null;
          if (normalized) {
            restored = { ...restored, room: normalized };
            applyProjectRoomToWallStore(normalized);
          } else {
            wallStore.getState().loadRoomConfig(rs);
          }
        } else if (snapshot.roomSnapshot === null) {
          wallStore.getState().clearRoom();
        }
        undoStackRef.current = [];
        redoStackRef.current = [];
        clearAllCutlistCache();
        logProjectIo("imported-project-loaded", {
          slug: projectNameSlug,
          boxes: restored.workspaceBoxes?.length ?? 0,
        });
        updateProject(
          () => ({
            ...restored,
            projectName: restored.projectName?.trim() || restored.projectName,
            currentProjectId: null,
          }),
          false
        );
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
      setProjectDesigner: (designer: string) => {
        updateProject((prev) => ({ ...prev, designer }), true);
      },
      setEmpresaExecutora: (empresa: string) => {
        updateProject((prev) => ({ ...prev, empresaExecutora: empresa }), true);
      },
      setMateriaisProjeto: (materiais: string) => {
        updateProject((prev) => ({ ...prev, materiaisProjeto: materiais }), true);
      },
      createNewProject: async () => {
        const currentUser = getCurrentProjectUser();
        const freshState = applyResultados({
          ...defaultState,
          designer: resolveProjectDesigner(defaultState, currentUser.ownerName),
          empresaExecutora: defaultState.empresaExecutora || DEFAULT_EMPRESA_EXECUTORA,
          materiaisProjeto: "",
        });
        const snapshot: ProjectSnapshot = {
          projectState: serializeState(freshState),
          viewerSnapshot: null,
          roomSnapshot: null,
        };
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
        clearIndustrialLiveProject();
        updateProject(() => ({ ...freshState, lastAutosaveTime: saved.updatedAt }), false);
        return saved;
      },
      applyDesignWorkspaceState: (state, opts) => {
        updateProject(() => state, opts?.pushUndo === true);
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
