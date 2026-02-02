import { useCallback, useRef } from "react";
import type {
  ProjectState,
  Viewer2DAngle,
  ViewerApi,
  ViewerRenderOptions,
  ViewerRenderResult,
  ViewerSnapshot,
  ViewerSync,
  ViewerToolMode,
} from "../context/projectTypes";

/**
 * Hook que fornece a interface ViewerSync para o ProjectContext.
 * O viewer real é registrado via registerViewerApi pelo Workspace (adapter de PimoViewerApi).
 * Fluxo: Workspace → createViewerApiAdapter → viewerSync.registerViewerApi(adapter)
 */
export const useViewerSync = (project: ProjectState): ViewerSync => {
  const viewerApiRef = useRef<ViewerApi | null>(null);

  /** Placeholder: sincronizar estado do projeto para o viewer (ex.: posições). */
  const applyStateToViewer = useCallback(() => {}, []);

  /** Placeholder: extrair estado do viewer para o projeto. */
  const extractStateFromViewer = useCallback(() => {}, []);

  const restoreViewerSnapshot = useCallback((snapshot: ViewerSnapshot | null) => {
    viewerApiRef.current?.restoreSnapshot(snapshot);
  }, []);

  const enable2DView = useCallback((angle: Viewer2DAngle) => {
    viewerApiRef.current?.enable2DView(angle);
  }, []);

  const disable2DView = useCallback(() => {
    viewerApiRef.current?.disable2DView();
  }, []);

  const renderScene = useCallback(
    (options: ViewerRenderOptions): ViewerRenderResult | null =>
      viewerApiRef.current?.renderScene(options) ?? null,
    []
  );

  const setActiveTool = useCallback((mode: ViewerToolMode) => {
    viewerApiRef.current?.setTool(mode);
  }, []);

  return {
    notifyChangeSignal: project,
    applyStateToViewer,
    extractStateFromViewer,
    saveViewerSnapshot: () => viewerApiRef.current?.saveSnapshot() ?? null,
    restoreViewerSnapshot,
    registerViewerApi: (api) => {
      viewerApiRef.current = api;
    },
    enable2DView,
    disable2DView,
    renderScene,
    setActiveTool,
  };
};
