import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ProjectContext } from "./projectContext";
import type { ProjectHistoryEntry, ProjectState } from "./projectTypes";
import { applyResultados } from "./projectState";
import { useViewerSync } from "../hooks/useViewerSync";
import { useProjectExportActions } from "./hooks/useProjectExportActions";
import { useProjectPersistence } from "./hooks/useProjectPersistence";
import { captureRoomSnapshot, serializeStateForAutosave, reviveState } from "./projectPersistence";
import { useProjectActions } from "./hooks/useProjectActions";
import { useProjectState } from "../project/useProjectState";
import { HISTORY_MAX_ENTRIES } from "./historyConfig";
import {
  getIndustrialLiveProject,
  publishIndustrialLiveProject,
} from "@/core/industrial/onlineAnalysis/industrialLiveProjectStore";

function classifyHistoryAction(actionName: string): "move" | "resize" | "add" | "remove" | "height" | "other" {
  const text = actionName.trim().toLowerCase();
  if (!text) return "other";
  if (
    text.includes("move") ||
    text.includes("mover") ||
    text.includes("posi") ||
    text.includes("arrast")
  ) {
    return "move";
  }
  if (
    text.includes("redimension") ||
    text.includes("dimens") ||
    text.includes("largura") ||
    text.includes("profund")
  ) {
    return "resize";
  }
  if (text.includes("altura") || text.includes("feetheight")) {
    return "height";
  }
  if (
    text.includes("adicion") ||
    text.includes("criado") ||
    text.includes("novo") ||
    text.includes("duplicad")
  ) {
    return "add";
  }
  if (text.includes("remov") || text.includes("apag")) {
    return "remove";
  }
  return "other";
}

export type ProjectProviderProps = {
  children: ReactNode;
  /**
   * `pipro-design`: estado isolado para Workspace Pipro v2 —
   * sem autosave de projecto e sem publicar industrial live SSOT.
   */
  variant?: "default" | "pipro-design";
};

export function ProjectProvider({ children, variant = "default" }: ProjectProviderProps) {
  const isPiproDesign = variant === "pipro-design";
  const { project, setProject, projectRef } = useProjectState(() =>
    isPiproDesign ? null : getIndustrialLiveProject()?.state ?? null
  );

  useEffect(() => {
    projectRef.current = project;
  }, [project, projectRef]);

  // Publicar SSOT live em cada alteração — /analise e ZIP leem o mesmo estado.
  useEffect(() => {
    if (isPiproDesign) return;
    publishIndustrialLiveProject(project);
  }, [project, isPiproDesign]);

  const viewerSync = useViewerSync(project);
  const exportActions = useProjectExportActions({ projectRef });
  useProjectPersistence(
    project,
    setProject,
    viewerSync,
    {
      serializeForAutosave: (state) => serializeStateForAutosave(state),
      revive: (snap) => reviveState(snap),
      captureRoomSnapshot,
      applyResultados,
    },
    { disabled: isPiproDesign }
  );

  const undoStackRef = useRef<ProjectState[]>([]);
  const redoStackRef = useRef<ProjectState[]>([]);
  const [historyStacks, setHistoryStacks] = useState<{ undo: ProjectState[]; redo: ProjectState[] }>({
    undo: [],
    redo: [],
  });

  const updateProject = useCallback(
    (fn: (_prev: ProjectState) => ProjectState, pushUndo?: boolean) => {
      setProject((prev) => {
        const next = fn(prev);
        if (pushUndo) {
          undoStackRef.current = [prev, ...undoStackRef.current].slice(0, HISTORY_MAX_ENTRIES);
          redoStackRef.current = [];
        }
        return next;
      });
    },
    [setProject]
  );

  const actions = useProjectActions({
    updateProject,
    setProject,
    viewerSync,
    exportActions,
    undoStackRef,
    redoStackRef,
    projectRef,
  });

  useEffect(() => {
    setHistoryStacks({
      undo: [...undoStackRef.current].slice(0, HISTORY_MAX_ENTRIES),
      redo: [...redoStackRef.current].slice(0, HISTORY_MAX_ENTRIES),
    });
  }, [project]);

  const history = useMemo(() => {
    const past = [...historyStacks.undo].reverse();
    const future = [...historyStacks.redo];
    const timeline = [...past, project, ...future];
    const entries: ProjectHistoryEntry[] = timeline.map((state, idx) => {
      const changelog = state.changelog?.[0];
      const actionName = changelog?.message?.trim() || (idx === past.length ? "Estado atual" : "Alteração");
      const tsRaw: unknown = changelog?.timestamp;
      let timestamp: string | null = null;
      if (tsRaw instanceof Date) {
        timestamp = tsRaw.toISOString();
      } else if (typeof tsRaw === "string" && tsRaw.trim().length > 0) {
        timestamp = tsRaw;
      }
      return {
        id: changelog?.id ?? `history-${idx}`,
        actionName,
        timestamp,
        actionType: classifyHistoryAction(actionName),
      };
    });
    return {
      entries,
      currentIndex: past.length,
      canUndo: historyStacks.undo.length > 0,
      canRedo: historyStacks.redo.length > 0,
      undo: actions.undo,
      redo: actions.redo,
      goTo: actions.goToHistory,
    };
  }, [project, actions, historyStacks]);

  return (
    <ProjectContext.Provider value={{ project, actions, viewerSync, history }}>
      {children}
    </ProjectContext.Provider>
  );
}
