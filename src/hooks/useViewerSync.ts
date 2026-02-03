import { useCallback, useRef } from "react";
import type {
  DoorWindowConfig,
  ProjectState,
  RoomConfig,
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
    (options: ViewerRenderOptions): Promise<ViewerRenderResult | null> =>
      viewerApiRef.current?.renderScene(options) ?? Promise.resolve(null),
    []
  );

  const setActiveTool = useCallback((mode: ViewerToolMode) => {
    viewerApiRef.current?.setTool(mode);
  }, []);

  const setUltraPerformanceMode = useCallback((active: boolean) => {
    viewerApiRef.current?.setUltraPerformanceMode(active);
  }, []);

  const getUltraPerformanceMode = useCallback(
    () => viewerApiRef.current?.getUltraPerformanceMode() ?? false,
    []
  );

  const createRoom = useCallback((config: RoomConfig) => {
    viewerApiRef.current?.createRoom(config);
  }, []);

  const removeRoom = useCallback(() => {
    viewerApiRef.current?.removeRoom();
  }, []);

  const setPlacementMode = useCallback((mode: "door" | "window" | null) => {
    viewerApiRef.current?.setPlacementMode?.(mode);
  }, []);

  const addDoorToRoom = useCallback(
    (wallId: number, config: DoorWindowConfig) =>
      viewerApiRef.current?.addDoorToRoom?.(wallId, config) ?? "",
    []
  );

  const addWindowToRoom = useCallback(
    (wallId: number, config: DoorWindowConfig) =>
      viewerApiRef.current?.addWindowToRoom?.(wallId, config) ?? "",
    []
  );

  const setOnRoomElementPlaced = useCallback(
    (
      cb: ((_wallId: number, _config: DoorWindowConfig, _type: "door" | "window") => void) | null
    ) => {
      viewerApiRef.current?.setOnRoomElementPlaced?.(cb);
    },
    []
  );

  const setOnRoomElementSelected = useCallback(
    (
      cb: ((_data: { elementId: string; wallId: number; type: "door" | "window"; config: DoorWindowConfig } | null) => void) | null
    ) => {
      viewerApiRef.current?.setOnRoomElementSelected?.(cb);
    },
    []
  );

  const updateRoomElementConfig = useCallback(
    (elementId: string, config: DoorWindowConfig) =>
      viewerApiRef.current?.updateRoomElementConfig?.(elementId, config) ?? false,
    []
  );

  const setExplodedView = useCallback((enabled: boolean) => {
    viewerApiRef.current?.setExplodedView?.(enabled);
  }, []);

  const getExplodedView = useCallback(
    () => viewerApiRef.current?.getExplodedView?.() ?? false,
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
    setActiveTool,
    setUltraPerformanceMode,
    getUltraPerformanceMode,
    createRoom,
    removeRoom,
    setPlacementMode,
    addDoorToRoom,
    addWindowToRoom,
    setOnRoomElementPlaced,
    setOnRoomElementSelected,
    updateRoomElementConfig,
    setExplodedView,
    getExplodedView,
  };
};
