import { useMemo } from "react";
import type { ProjectActions, ViewerToolMode } from "../projectTypes";
import type { ProjectActionsExecutionContext } from "./projectActionsDeps";

export type ViewerUiActions = Pick<
  ProjectActions,
  "setActiveTool" | "setViewerSettings" | "toggleHighlight" | "toggleRuler" | "toggleInternalRuler" | "setLayoutWarnings"
>;

export function useViewerUiActions(ctx: ProjectActionsExecutionContext): ViewerUiActions {
  const { updateProject, viewerSync } = ctx;

  return useMemo(() => {
    const a = {} as ViewerUiActions;

    a.setActiveTool = (mode: ViewerToolMode) => {
      updateProject((prev) => ({ ...prev, activeViewerTool: mode }), true);
      viewerSync.setActiveTool(mode);
    };

    a.setViewerSettings = (partial) => {
      updateProject(
        (prev) => ({
          ...prev,
          viewerSettings: {
            ...prev.viewerSettings,
            ...partial,
          },
        }),
        true
      );
    };

    a.toggleHighlight = () => {
      updateProject(
        (prev) => ({
          ...prev,
          viewerSettings: {
            ...prev.viewerSettings,
            highlightEnabled: !prev.viewerSettings.highlightEnabled,
          },
        }),
        true
      );
    };

    a.toggleRuler = () => {
      updateProject(
        (prev) => {
          const next = !prev.viewerSettings.rulerEnabled;
          return {
            ...prev,
            viewerSettings: {
              ...prev.viewerSettings,
              rulerEnabled: next,
              internalRulerEnabled: next,
            },
          };
        },
        true
      );
    };

    a.toggleInternalRuler = () => {
      a.toggleRuler();
    };

    a.setLayoutWarnings = (warnings) => {
      // Derived warnings update frequently; keep out of undo/redo.
      updateProject((prev) => ({ ...prev, layoutWarnings: warnings }), false);
    };

    return a;
  }, [updateProject, viewerSync]);
}
