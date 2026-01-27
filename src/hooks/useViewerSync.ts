import { useCallback, useRef } from "react";
import type {
  ProjectState,
  Viewer2DAngle,
  ViewerApi,
  ViewerRenderOptions,
  ViewerRenderResult,
  ViewerSnapshot,
  ViewerSync,
} from "../context/projectTypes";

export const useViewerSync = (project: ProjectState): ViewerSync => {
  const viewerApiRef = useRef<ViewerApi | null>(null);

  const applyStateToViewer = useCallback(() => {
    // placeholder: integração real será adicionada depois
  }, []);

  const extractStateFromViewer = useCallback(() => {
    // placeholder: integração real será adicionada depois
  }, []);

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
  };
};
