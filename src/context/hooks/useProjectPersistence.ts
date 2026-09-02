/**
 * Lógica de autosave e carregamento a partir do autosave.
 * Extraído do ProjectProvider para reduzir complexidade.
 */

import { useCallback, useEffect, useRef } from "react";
import { safeGetItem, safeSetItem } from "../../utils/storage";
import { normalizeProjectRoom, wallStoreToProjectRoom } from "../../3d/viewer-engine/room/RoomEngine";
import type { ProjectState, ProjectSnapshot, RoomSnapshot } from "../projectTypes";
import { defaultState } from "../projectState";

const AUTOSAVE_STORAGE_KEY = "pimo_autosave";
const AUTO_SAVE_BASE_DEBOUNCE_MS = 1200;

function isProjectCompletelyDefaultForPersistence(proj: ProjectState): boolean {
  if ((proj.workspaceBoxes?.length ?? 0) > 0) return false;
  if ((proj.projectName?.trim() || "") !== defaultState.projectName) return false;
  if (proj.room) return false;
  return true;
}

export type ProjectPersistenceApi = {
  serializeForAutosave: (_state: ProjectState) => unknown;
  revive: (_snapshot: unknown) => ProjectState | null;
  captureRoomSnapshot: () => RoomSnapshot | null;
  /** Opcional: aplicar resultados ao estado restaurado (ex.: applyResultados). */
  applyResultados?: (_state: ProjectState) => ProjectState;
};

export type ProjectPersistenceOptions = {
  /** Se true, não lê/grava autosave nem beforeunload (modo design pipro). */
  disabled?: boolean;
};

export function useProjectPersistence(
  project: ProjectState,
  setProject: React.Dispatch<React.SetStateAction<ProjectState>>,
  viewerSync: { saveViewerSnapshot: () => unknown; restoreViewerSnapshot: (_snapshot: unknown) => void },
  api: ProjectPersistenceApi,
  options?: ProjectPersistenceOptions
) {
  const disabled = options?.disabled === true;
  const projectRef = useRef(project);
  projectRef.current = project;
  const autosaveTimerRef = useRef<number | null>(null);
  const lastAutosaveFingerprintRef = useRef<string>("");
  const pendingAutosaveRef = useRef(false);

  const performAutosave = useCallback(() => {
    if (disabled) return;
    const proj = projectRef.current;
    if (isProjectCompletelyDefaultForPersistence(proj)) return;
    if (proj.estaCarregando) {
      pendingAutosaveRef.current = true;
      return;
    }
    const snapshot: ProjectSnapshot = {
      projectState: api.serializeForAutosave(proj) as ProjectSnapshot["projectState"],
      viewerSnapshot: viewerSync.saveViewerSnapshot() as ProjectSnapshot["viewerSnapshot"],
      roomSnapshot: api.captureRoomSnapshot(),
    };
    const savedAt = new Date().toISOString();
    safeSetItem(
      AUTOSAVE_STORAGE_KEY,
      JSON.stringify({ snapshot, savedAt })
    );
    pendingAutosaveRef.current = false;
    setProject((prev) =>
      prev.lastAutosaveTime === savedAt ? prev : { ...prev, lastAutosaveTime: savedAt }
    );
  }, [viewerSync, setProject, api, disabled]);

  const scheduleAutosave = useCallback(
    (ms: number) => {
      if (autosaveTimerRef.current != null) {
        window.clearTimeout(autosaveTimerRef.current);
      }
      autosaveTimerRef.current = window.setTimeout(() => {
        autosaveTimerRef.current = null;
        performAutosave();
      }, ms);
    },
    [performAutosave]
  );

  useEffect(() => {
    if (disabled) return;
    const raw = safeGetItem(AUTOSAVE_STORAGE_KEY);
    if (!raw) return;
    let parsed: { snapshot?: ProjectSnapshot; savedAt?: string };
    try {
      parsed = JSON.parse(raw) as { snapshot?: ProjectSnapshot; savedAt?: string };
    } catch {
      return;
    }
    const snap = parsed?.snapshot;
    const projectState =
      snap && typeof snap === "object" && "projectState" in snap
        ? (snap as ProjectSnapshot).projectState
        : null;
    const viewerSnapshot =
      snap && typeof snap === "object" && "viewerSnapshot" in snap
        ? (snap as ProjectSnapshot).viewerSnapshot
        : null;
    const roomSnapshot =
      snap && typeof snap === "object" && "roomSnapshot" in snap
        ? (snap as ProjectSnapshot).roomSnapshot
        : undefined;
    const restored = projectState ? api.revive(projectState) : null;
    if (restored) {
      let next = api.applyResultados
        ? api.applyResultados({ ...restored, lastAutosaveTime: parsed.savedAt ?? restored.lastAutosaveTime ?? null })
        : { ...restored, lastAutosaveTime: parsed.savedAt ?? restored.lastAutosaveTime ?? null };
      if (next.room) {
        next = { ...next, room: normalizeProjectRoom(next.room) ?? next.room };
      } else if (roomSnapshot?.walls?.length) {
        const promoted = wallStoreToProjectRoom(roomSnapshot.walls);
        const normalized = promoted ? normalizeProjectRoom(promoted) : null;
        if (normalized) {
          next = { ...next, room: normalized };
        }
      } else if (roomSnapshot === null) {
        next = { ...next, room: null };
      }
      setProject(next);
    } else if (roomSnapshot !== undefined && roomSnapshot?.walls?.length) {
      // Autosave sem projectState mas com roomSnapshot: sem SSOT de projecto, ignoramos o sidecar.
    }
    if (viewerSnapshot) {
      viewerSync.restoreViewerSnapshot(viewerSnapshot);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  useEffect(() => {
    if (disabled) return;
    const proj = project;
    if (isProjectCompletelyDefaultForPersistence(proj)) return;
    const fingerprint = JSON.stringify(api.serializeForAutosave(proj));
    if (fingerprint === lastAutosaveFingerprintRef.current) return;
    lastAutosaveFingerprintRef.current = fingerprint;
    const boxCount = proj.workspaceBoxes.length;
    const debounceMs = proj.estaCarregando
      ? AUTO_SAVE_BASE_DEBOUNCE_MS * 2
      : boxCount > 12
        ? AUTO_SAVE_BASE_DEBOUNCE_MS * 2
        : AUTO_SAVE_BASE_DEBOUNCE_MS;
    scheduleAutosave(debounceMs);
  }, [project, scheduleAutosave, api]);

  useEffect(() => {
    if (disabled) return;
    if (project.estaCarregando) return;
    if (pendingAutosaveRef.current) {
      scheduleAutosave(450);
    }
  }, [project.estaCarregando, scheduleAutosave, disabled]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current != null) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (disabled) return;
    const handler = (e: BeforeUnloadEvent) => {
      const proj = projectRef.current;
      if (!isProjectCompletelyDefaultForPersistence(proj)) {
        e.preventDefault();
        e.returnValue = "Você perderá o seu projeto atual. Deseja continuar?";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [disabled]);

  return { performAutosave, scheduleAutosave };
}
