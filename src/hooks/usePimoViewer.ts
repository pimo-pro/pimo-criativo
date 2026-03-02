import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Viewer } from "../3d/core/Viewer";
import type { ViewerOptions } from "../3d/core/Viewer";
import type { BoxOptions } from "../3d/objects/BoxBuilder";
import type {
  ViewerBackgroundMode,
  ViewerMaterialQuality,
  UltraPerformanceModeOptions,
  DoorWindowConfig,
  RoomConfig,
  ViewerMousePreset,
  ViewerRenderOptions,
  ViewerRenderResult,
} from "../context/projectTypes";

type PimoViewerAPI = {
  viewerRef: React.MutableRefObject<Viewer | null>;
  viewerReady: boolean;
  selectedBoxId: string | null;
  onBoxSelected: (_callback: (_id: string | null) => void) => void;
  setOnBoxSelected: (_callback: (_id: string | null) => void) => void;
  setOnDoorLayerDoubleClick: (_callback: ((_boxId: string, _doorLayerId: string) => void) | null) => void;
  selectBox: (_id: string | null) => void;
  addBox: (_id: string, _options?: BoxOptions) => boolean;
  removeBox: (_id: string) => boolean;
  updateBox: (_id: string, _options: Partial<BoxOptions>) => boolean;
  setBoxIndex: (_id: string, _index: number) => boolean;
  setBoxPosition: (_id: string, _position: { x: number; y: number; z: number }) => boolean;
  setBoxGap: (_gap: number) => void;
  addModelToBox: (_boxId: string, _modelPath: string, _modelId?: string) => boolean;
  removeModelFromBox: (_boxId: string, _modelId: string) => boolean;
  clearModelsFromBox: (_boxId: string) => void;
  listModels: (_boxId: string) => Array<{ id: string; path: string }> | null;
  getBoxDimensions: (_boxId: string) => { width: number; height: number; depth: number } | null;
  getModelPosition: (_boxId: string, _modelId: string) => { x: number; y: number; z: number } | null;
  getModelBoundingBoxSize: (_boxId: string, _modelId: string) => { width: number; height: number; depth: number } | null;
  setModelPosition: (_boxId: string, _modelId: string, _position: { x: number; y: number; z: number }) => boolean;
  setOnModelLoaded: (_callback: ((_boxId: string, _modelId: string, _object: unknown) => void) | null) => void;
  setOnBoxTransform: (_callback: ((_boxId: string, _position: { x: number; y: number; z: number }, _rotationY: number) => void) | null) => void;
  setOnWallSelected: (_callback: ((_wallId: number | null) => void) | null) => void;
  setOnWallTransform: (_callback: ((_wallIndex: number, _position: { x: number; z: number }, _rotation: number) => void) | null) => void;
  setOnRoomElementTransform: (_callback: ((_elementId: string, _config: DoorWindowConfig) => void) | null) => void;
  setTransformMode: (_mode: "translate" | "rotate" | null) => void;
  highlightBox: (_id: string | null) => void;
  setRoomBounds: (_bounds: {
    width: number;
    depth: number;
    height: number;
    originX?: number;
    originZ?: number;
  }) => void;
  clearRoomBounds: () => void;
  setCameraView: (_preset: "top" | "bottom" | "front" | "back" | "right" | "left" | "isometric") => void;
  resetCamera: () => void;
  setShowcaseMode: (_active: boolean, _turntable?: boolean) => void;
  getShowcaseMode: () => boolean;
  getCurrentMode: () => "performance" | "showcase";
  setMode: (_mode: "performance" | "showcase", _turntable?: boolean) => void;
  renderScene: (_options: ViewerRenderOptions) => Promise<ViewerRenderResult | null>;
  setUltraPerformanceMode: (_active: boolean) => void;
  getUltraPerformanceMode: () => boolean;
  setUltraPerformanceModeOptions?: (_options: UltraPerformanceModeOptions) => void;
  getUltraPerformanceModeOptions?: () => UltraPerformanceModeOptions;
  createRoom: (_config: RoomConfig) => void;
  removeRoom: () => void;
  selectWallByIndex: (_index: number | null) => void;
  selectRoomElementById: (_elementId: string | null) => void;
  setPlacementMode: (_mode: "door" | "window" | null) => void;
  addDoorToRoom: (_wallId: number, _config: DoorWindowConfig) => string;
  addWindowToRoom: (_wallId: number, _config: DoorWindowConfig) => string;
  setOnRoomElementPlaced: (
    _cb: ((_wallId: number, _config: DoorWindowConfig, _type: "door" | "window") => void) | null
  ) => void;
  setOnRoomElementSelected: (
    _cb: ((_data: { elementId: string; wallId: number; type: "door" | "window"; config: DoorWindowConfig } | null) => void) | null
  ) => void;
  updateRoomElementConfig: (_elementId: string, _config: DoorWindowConfig) => boolean;
  setLockEnabled: (_enabled: boolean) => void;
  getLockEnabled: () => boolean;
  getCombinedBoundingBox: () => {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
    size: { x: number; y: number; z: number };
    width: number;
    height: number;
    depth: number;
  } | null;
  getSelectedBoxDimensions: () => { width: number; height: number; depth: number } | null;
  setDimensionsOverlayVisible: (_visible: boolean) => void;
  getDimensionsOverlayVisible: () => boolean;
  getRightmostX: () => number;
  setManualWallHidden?: (_active: boolean) => void;
  getManualWallHidden?: () => boolean;
  /** Sala (RoomManager): criar com dimensões, remover, adicionar parede, lock. */
  createRoomWithDimensions?: (_width: number, _depth: number, _height: number) => void;
  setRoomDimensions?: (_width: number, _depth: number, _height: number) => void;
  addExtraWall?: () => void;
  setRoomLocked?: (_locked: boolean) => void;
  getRoomExists?: () => boolean;
  getRoomLocked?: () => boolean;
  getRoomDimensions?: () => { width: number; depth: number; height: number } | null;
  getRoomVisible?: () => boolean;
  hideRoom?: () => void;
  showRoom?: () => void;
  setPanelEdgesVisible?: (_visible: boolean) => void;
  setPanelHidden?: (_panel: "left" | "right" | "top" | "bottom" | "back", _hidden: boolean) => void;
  setHiddenPanels?: (_keys: string[]) => void;
  getHiddenPanels?: () => string[];
  setAllPanelsHidden?: (_hidden: boolean) => void;
  setRoomCeilingVisible?: (_visible: boolean) => void;
  setWallEditMode?: (_enabled: boolean) => void;
  setMousePreset?: (_preset: ViewerMousePreset) => void;
  getMousePreset?: () => ViewerMousePreset;
  setBackgroundMode?: (_mode: ViewerBackgroundMode) => void;
  getBackgroundMode?: () => ViewerBackgroundMode;
  setMaterialQuality?: (_quality: ViewerMaterialQuality) => void;
  getMaterialQuality?: () => ViewerMaterialQuality;
  setReflectionsEnabled?: (_enabled: boolean) => void;
  getReflectionsEnabled?: () => boolean;
  setPhotoModeEnabled?: (_enabled: boolean) => void;
  getPhotoModeEnabled?: () => boolean;
  capturePhotoDataUrl?: (_format?: "png" | "jpg", _quality?: number) => string | null;
  setExplodedViewEnabled?: (_enabled: boolean) => void;
  getExplodedViewEnabled?: () => boolean;
  setExplodedViewIntensity?: (_value: number) => void;
  getExplodedViewIntensity?: () => number;
};

export const usePimoViewer = (
  containerRef: RefObject<HTMLDivElement | null>,
  options?: ViewerOptions
): PimoViewerAPI => {
  const viewerRef = useRef<Viewer | null>(null);
  const optionsRef = useRef(options);
  const [viewerReady, setViewerReady] = useState(false);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const onBoxSelectedRef = useRef<((_id: string | null) => void) | null>(null);
  const onDoorLayerDoubleClickRef = useRef<((_boxId: string, _doorLayerId: string) => void) | null>(null);
  const preReadyRotationAttemptsRef = useRef<Map<string, number>>(new Map());
  const preReadyLastLogRef = useRef(0);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (viewerRef.current) {
      requestAnimationFrame(() => setViewerReady(true));
      return;
    }

    viewerRef.current = new Viewer(container, optionsRef.current ?? {});
    viewerRef.current.setOnBoxSelected((id) => {
      setSelectedBoxId(id);
      onBoxSelectedRef.current?.(id);
    });
    viewerRef.current.setOnDoorLayerDoubleClick((boxId, doorLayerId) => {
      onDoorLayerDoubleClickRef.current?.(boxId, doorLayerId);
    });
    // Marcar viewer como pronto após um frame para garantir que o canvas foi dimensionado
    const raf = requestAnimationFrame(() => {
      setViewerReady(true);
    });

    return () => {
      cancelAnimationFrame(raf);
      viewerRef.current?.dispose();
      viewerRef.current = null;
      setViewerReady(false);
    };
  }, [containerRef]);

  const setOnBoxSelected = useCallback((_callback: (_id: string | null) => void) => {
    onBoxSelectedRef.current = _callback;
  }, []);

  const setOnDoorLayerDoubleClick = useCallback(
    (_callback: ((_boxId: string, _doorLayerId: string) => void) | null) => {
      onDoorLayerDoubleClickRef.current = _callback;
    },
    []
  );

  const logPreReadyRotationAttempt = useCallback((pseudoUuid: string) => {
    if (!import.meta.env.DEV) return;
    const map = preReadyRotationAttemptsRef.current;
    map.set(pseudoUuid, (map.get(pseudoUuid) ?? 0) + 1);
    const now = performance.now();
    if (now - preReadyLastLogRef.current < 2000) return;
    preReadyLastLogRef.current = now;
    const rows = Array.from(map.entries()).map(([uuid, attempts]) => ({
      uuid,
      pre_ready_rotation_attempts: attempts,
    }));
    console.groupCollapsed("[Viewer Rotation Diagnostics] attempts before viewerReady");
    console.table(rows);
    console.groupEnd();
  }, []);

  const addBox = useCallback(
    (id: string, boxOptions?: BoxOptions) => {
      const viewer = viewerRef.current;
      if (!viewer || !viewerReady) {
        if (boxOptions?.rotationY != null && Number.isFinite(boxOptions.rotationY)) {
          logPreReadyRotationAttempt(`pending:${id}`);
        }
        return false;
      }
      return viewer.addBox(id, boxOptions);
    },
    [viewerReady, logPreReadyRotationAttempt]
  );

  const removeBox = useCallback(
    (id: string) => viewerRef.current?.removeBox(id) ?? false,
    []
  );

  const updateBox = useCallback(
    (id: string, boxOptions: Partial<BoxOptions>) => {
      const viewer = viewerRef.current;
      if (!viewer) return false;
      const hasDimensionOpts =
        boxOptions.width !== undefined ||
        boxOptions.height !== undefined ||
        boxOptions.depth !== undefined ||
        boxOptions.size !== undefined;
      if (!viewerReady && !hasDimensionOpts) {
        if (boxOptions.rotationY != null && Number.isFinite(boxOptions.rotationY)) {
          logPreReadyRotationAttempt(`pending:${id}`);
        }
        return false;
      }
      return viewer.updateBox(id, boxOptions);
    },
    [viewerReady, logPreReadyRotationAttempt]
  );

  const setBoxIndex = useCallback(
    (id: string, index: number) => viewerRef.current?.setBoxIndex(id, index) ?? false,
    []
  );

  const setBoxPosition = useCallback(
    (id: string, position: { x: number; y: number; z: number }) => {
      const viewer = viewerRef.current;
      if (!viewer || !viewerReady) return false;
      return viewer.setBoxPosition(id, position);
    },
    [viewerReady]
  );

  const setRoomBounds = useCallback(
    (bounds: {
      width: number;
      depth: number;
      height: number;
      originX?: number;
      originZ?: number;
    }) => {
      viewerRef.current?.setRoomBounds(bounds);
    },
    []
  );

  const clearRoomBounds = useCallback(() => {
    viewerRef.current?.clearRoomBounds();
  }, []);

  const setCameraView = useCallback(
    (preset: "top" | "bottom" | "front" | "back" | "right" | "left" | "isometric") => {
      viewerRef.current?.setCameraView(preset);
    },
    []
  );

  const resetCamera = useCallback(() => {
    viewerRef.current?.resetCamera?.();
  }, []);

  const setBoxGap = useCallback((gap: number) => {
    viewerRef.current?.setBoxGap(gap);
  }, []);

  const addModelToBox = useCallback(
    (boxId: string, modelPath: string, modelId?: string) =>
      viewerRef.current?.addModelToBox(boxId, modelPath, modelId) ?? false,
    []
  );

  const removeModelFromBox = useCallback(
    (boxId: string, modelId: string) =>
      viewerRef.current?.removeModelFromBox(boxId, modelId) ?? false,
    []
  );

  const clearModelsFromBox = useCallback((boxId: string) => {
    viewerRef.current?.clearModelsFromBox(boxId);
  }, []);

  const listModels = useCallback(
    (boxId: string) => viewerRef.current?.listModels(boxId) ?? null,
    []
  );

  const getBoxDimensions = useCallback(
    (boxId: string) => viewerRef.current?.getBoxDimensions(boxId) ?? null,
    []
  );

  const getModelPosition = useCallback(
    (boxId: string, modelId: string) =>
      viewerRef.current?.getModelPosition(boxId, modelId) ?? null,
    []
  );

  const getModelBoundingBoxSize = useCallback(
    (boxId: string, modelId: string) =>
      viewerRef.current?.getModelBoundingBoxSize(boxId, modelId) ?? null,
    []
  );

  const setModelPosition = useCallback(
    (boxId: string, modelId: string, position: { x: number; y: number; z: number }) =>
      viewerRef.current?.setModelPosition(boxId, modelId, position) ?? false,
    []
  );

  const setOnModelLoaded = useCallback(
    (_callback: ((_boxId: string, _modelId: string, _object: unknown) => void) | null) => {
      viewerRef.current?.setOnModelLoaded(_callback ?? null);
    },
    []
  );

  const setOnBoxTransform = useCallback(
    (_callback: ((_boxId: string, _position: { x: number; y: number; z: number }, _rotationY: number) => void) | null) => {
      viewerRef.current?.setOnBoxTransform(_callback ?? null);
    },
    []
  );

  const setOnWallSelected = useCallback((_callback: ((_wallId: number | null) => void) | null) => {
    viewerRef.current?.setOnWallSelected(_callback ?? null);
  }, []);

  const setOnWallTransform = useCallback(
    (_callback: ((_wallIndex: number, _position: { x: number; z: number }, _rotation: number) => void) | null) => {
      viewerRef.current?.setOnWallTransform(_callback ?? null);
    },
    []
  );

  const setOnRoomElementTransform = useCallback(
    (_callback: ((_elementId: string, _config: DoorWindowConfig) => void) | null) => {
      viewerRef.current?.setOnRoomElementTransform(_callback ?? null);
    },
    []
  );

  const setTransformMode = useCallback((mode: "translate" | "rotate" | null) => {
    viewerRef.current?.setTransformMode(mode);
  }, []);

  const highlightBox = useCallback((id: string | null) => {
    viewerRef.current?.highlightBox(id);
  }, []);

  const setShowcaseMode = useCallback((active: boolean, turntable?: boolean) => {
    viewerRef.current?.setShowcaseMode?.(active, turntable);
  }, []);

  const getShowcaseMode = useCallback(() => {
    return viewerRef.current?.getShowcaseMode?.() ?? false;
  }, []);

  const getCurrentMode = useCallback(() => {
    return viewerRef.current?.getCurrentMode?.() ?? "performance";
  }, []);

  const setMode = useCallback((mode: "performance" | "showcase", turntable?: boolean) => {
    viewerRef.current?.setMode?.(mode, turntable);
  }, []);

  const renderScene = useCallback(
    (options: ViewerRenderOptions): Promise<ViewerRenderResult | null> =>
      viewerRef.current?.renderScene?.(options) ?? Promise.resolve(null),
    []
  );

  const setUltraPerformanceMode = useCallback((active: boolean) => {
    viewerRef.current?.setUltraPerformanceMode?.(active);
  }, []);

  const getUltraPerformanceMode = useCallback(
    () => viewerRef.current?.getUltraPerformanceMode?.() ?? false,
    []
  );

  const setUltraPerformanceModeOptions = useCallback((options: UltraPerformanceModeOptions) => {
    viewerRef.current?.setUltraPerformanceModeOptions?.(options);
  }, []);

  const getUltraPerformanceModeOptions = useCallback(
    () =>
      viewerRef.current?.getUltraPerformanceModeOptions?.() ?? {
        enabled: false,
        mode: "balanced",
      },
    []
  );

  const createRoom = useCallback((config: RoomConfig) => {
    viewerRef.current?.createRoom(config);
  }, []);

  const removeRoom = useCallback(() => {
    viewerRef.current?.removeRoom();
  }, []);

  const setPlacementMode = useCallback((mode: "door" | "window" | null) => {
    viewerRef.current?.setPlacementMode?.(mode);
  }, []);

  const addDoorToRoom = useCallback(
    (wallId: number, config: DoorWindowConfig) =>
      viewerRef.current?.addDoorToRoom?.(wallId, config) ?? "",
    []
  );

  const addWindowToRoom = useCallback(
    (wallId: number, config: DoorWindowConfig) =>
      viewerRef.current?.addWindowToRoom?.(wallId, config) ?? "",
    []
  );

  const setOnRoomElementPlaced = useCallback(
    (
      cb: ((_wallId: number, _config: DoorWindowConfig, _type: "door" | "window") => void) | null
    ) => {
      viewerRef.current?.setOnRoomElementPlaced?.(cb);
    },
    []
  );

  const setOnRoomElementSelected = useCallback(
    (
      cb: ((_data: { elementId: string; wallId: number; type: "door" | "window"; config: DoorWindowConfig } | null) => void) | null
    ) => {
      viewerRef.current?.setOnRoomElementSelected?.(cb);
    },
    []
  );

  const setLockEnabled = useCallback((enabled: boolean) => {
    viewerRef.current?.setLockEnabled(enabled);
  }, []);

  const getLockEnabled = useCallback(
    () => viewerRef.current?.getLockEnabled?.() ?? false,
    []
  );

  const getCombinedBoundingBox = useCallback(
    () => viewerRef.current?.getCombinedBoundingBox?.() ?? null,
    []
  );

  const getSelectedBoxDimensions = useCallback(
    () => viewerRef.current?.getSelectedBoxDimensions?.() ?? null,
    []
  );

  const setDimensionsOverlayVisible = useCallback((visible: boolean) => {
    viewerRef.current?.setDimensionsOverlayVisible(visible);
  }, []);

  const getDimensionsOverlayVisible = useCallback(
    () => viewerRef.current?.getDimensionsOverlayVisible?.() ?? false,
    []
  );

  const getSelectedBoxScreenPosition = useCallback(
    () => viewerRef.current?.getSelectedBoxScreenPosition?.() ?? null,
    []
  );

  const getRightmostX = useCallback(
    () => viewerRef.current?.getRightmostX?.() ?? -0.1,
    []
  );

  const setManualWallHidden = useCallback((active: boolean) => {
    viewerRef.current?.setManualWallHidden?.(active);
  }, []);

  const getManualWallHidden = useCallback(
    () => viewerRef.current?.getManualWallHidden?.() ?? false,
    []
  );

  const createRoomWithDimensions = useCallback(
    (width: number, depth: number, height: number) => {
      viewerRef.current?.createRoomWithDimensions?.(width, depth, height);
    },
    []
  );
  const setRoomDimensions = useCallback(
    (width: number, depth: number, height: number) => {
      viewerRef.current?.setRoomDimensions?.(width, depth, height);
    },
    []
  );
  const addExtraWall = useCallback(() => {
    viewerRef.current?.addExtraWall?.();
  }, []);
  const setRoomLocked = useCallback((locked: boolean) => {
    viewerRef.current?.setRoomLocked?.(locked);
  }, []);
  const getRoomExists = useCallback(
    () => viewerRef.current?.getRoomExists?.() ?? false,
    []
  );
  const getRoomLocked = useCallback(
    () => viewerRef.current?.getRoomLocked?.() ?? false,
    []
  );
  const getRoomDimensions = useCallback(
    () => viewerRef.current?.getRoomDimensions?.() ?? null,
    []
  );
  const getRoomVisible = useCallback(
    () => viewerRef.current?.getRoomVisible?.() ?? false,
    []
  );
  const hideRoom = useCallback(() => {
    viewerRef.current?.hideRoom?.();
  }, []);
  const showRoom = useCallback(() => {
    viewerRef.current?.showRoom?.();
  }, []);

  const setPanelEdgesVisible = useCallback((visible: boolean) => {
    viewerRef.current?.setPanelEdgesVisible?.(visible);
  }, []);

  const setPanelHidden = useCallback((panel: "left" | "right" | "top" | "bottom" | "back", hidden: boolean) => {
    viewerRef.current?.setPanelHidden?.(panel, hidden);
  }, []);

  const setHiddenPanels = useCallback((keys: string[]) => {
    viewerRef.current?.setHiddenPanels?.(keys);
  }, []);

  const getHiddenPanels = useCallback(
    () => viewerRef.current?.getHiddenPanels?.() ?? [],
    []
  );

  const setAllPanelsHidden = useCallback((hidden: boolean) => {
    viewerRef.current?.setAllPanelsHidden?.(hidden);
  }, []);

  const setRoomCeilingVisible = useCallback((visible: boolean) => {
    viewerRef.current?.setRoomCeilingVisible?.(visible);
  }, []);

  const setWallEditMode = useCallback((enabled: boolean) => {
    viewerRef.current?.setWallEditMode?.(enabled);
  }, []);

  const setMousePreset = useCallback((preset: ViewerMousePreset) => {
    viewerRef.current?.setMousePreset?.(preset);
  }, []);

  const getMousePreset = useCallback(
    () => viewerRef.current?.getMousePreset?.() ?? "cad",
    []
  );

  const setBackgroundMode = useCallback((mode: ViewerBackgroundMode) => {
    viewerRef.current?.setBackgroundMode?.(mode);
  }, []);

  const getBackgroundMode = useCallback(
    () => viewerRef.current?.getBackgroundMode?.() ?? "studio",
    []
  );

  const setMaterialQuality = useCallback((quality: ViewerMaterialQuality) => {
    viewerRef.current?.setMaterialQuality?.(quality);
  }, []);

  const getMaterialQuality = useCallback(
    () => viewerRef.current?.getMaterialQuality?.() ?? "standard",
    []
  );

  const setReflectionsEnabled = useCallback((enabled: boolean) => {
    viewerRef.current?.setReflectionsEnabled?.(enabled);
  }, []);

  const getReflectionsEnabled = useCallback(
    () => viewerRef.current?.getReflectionsEnabled?.() ?? false,
    []
  );

  const setPhotoModeEnabled = useCallback((enabled: boolean) => {
    viewerRef.current?.setPhotoModeEnabled?.(enabled);
  }, []);

  const getPhotoModeEnabled = useCallback(
    () => viewerRef.current?.getPhotoModeEnabled?.() ?? false,
    []
  );

  const capturePhotoDataUrl = useCallback((format: "png" | "jpg" = "png", quality = 0.92) => {
    return viewerRef.current?.capturePhotoDataUrl?.(format, quality) ?? null;
  }, []);

  const setExplodedViewEnabled = useCallback((enabled: boolean) => {
    viewerRef.current?.setExplodedViewEnabled?.(enabled);
  }, []);

  const getExplodedViewEnabled = useCallback(
    () => viewerRef.current?.getExplodedViewEnabled?.() ?? false,
    []
  );

  const setExplodedViewIntensity = useCallback((value: number) => {
    viewerRef.current?.setExplodedViewIntensity?.(value);
  }, []);

  const getExplodedViewIntensity = useCallback(
    () => viewerRef.current?.getExplodedViewIntensity?.() ?? 0.35,
    []
  );

  const updateRoomElementConfig = useCallback(
    (elementId: string, config: DoorWindowConfig) =>
      viewerRef.current?.updateRoomElementConfig?.(elementId, config) ?? false,
    []
  );

  const selectBox = useCallback((id: string | null) => {
    viewerRef.current?.selectBox(id);
  }, []);

  const selectWallByIndex = useCallback((index: number | null) => {
    viewerRef.current?.selectWallByIndex?.(index);
  }, []);

  const selectRoomElementById = useCallback((elementId: string | null) => {
    viewerRef.current?.selectRoomElementById?.(elementId);
  }, []);

  return useMemo(
    () => ({
      viewerRef,
      viewerReady,
      selectedBoxId,
      onBoxSelected: setOnBoxSelected,
      setOnBoxSelected,
      setOnDoorLayerDoubleClick,
      selectBox,
      addBox,
      removeBox,
      updateBox,
      setBoxIndex,
      setBoxPosition,
      setBoxGap,
      addModelToBox,
      removeModelFromBox,
      clearModelsFromBox,
      listModels,
      getBoxDimensions,
      getModelPosition,
      getModelBoundingBoxSize,
      setModelPosition,
      setOnModelLoaded,
      setOnBoxTransform,
    setOnWallSelected,
    setOnWallTransform,
    setOnRoomElementTransform,
    setTransformMode,
      highlightBox,
    setRoomBounds,
    clearRoomBounds,
    setCameraView,
    resetCamera,
    setShowcaseMode,
      getShowcaseMode,
      getCurrentMode,
      setMode,
      renderScene,
      setUltraPerformanceMode,
      getUltraPerformanceMode,
      setUltraPerformanceModeOptions,
      getUltraPerformanceModeOptions,
      createRoom,
      removeRoom,
      selectWallByIndex,
      selectRoomElementById,
      setPlacementMode,
      addDoorToRoom,
      addWindowToRoom,
      setOnRoomElementPlaced,
      setOnRoomElementSelected,
      updateRoomElementConfig,
      setLockEnabled,
      getLockEnabled,
      getCombinedBoundingBox,
      getSelectedBoxDimensions,
      setDimensionsOverlayVisible,
      getDimensionsOverlayVisible,
      getSelectedBoxScreenPosition,
      getRightmostX,
      setManualWallHidden,
      getManualWallHidden,
      createRoomWithDimensions,
      setRoomDimensions,
      addExtraWall,
      setRoomLocked,
      getRoomExists,
      getRoomLocked,
      getRoomDimensions,
      getRoomVisible,
      hideRoom,
      showRoom,
      setPanelEdgesVisible,
      setPanelHidden,
      setHiddenPanels,
      getHiddenPanels,
      setAllPanelsHidden,
      setRoomCeilingVisible,
      setWallEditMode,
      setMousePreset,
      getMousePreset,
      setBackgroundMode,
      getBackgroundMode,
      setMaterialQuality,
      getMaterialQuality,
      setReflectionsEnabled,
      getReflectionsEnabled,
      setPhotoModeEnabled,
      getPhotoModeEnabled,
      capturePhotoDataUrl,
      setExplodedViewEnabled,
      getExplodedViewEnabled,
      setExplodedViewIntensity,
      getExplodedViewIntensity,
    }),
    [
      viewerReady,
      selectedBoxId,
      setOnBoxSelected,
      setOnDoorLayerDoubleClick,
      selectBox,
      addBox,
      removeBox,
      updateBox,
      setBoxIndex,
      setBoxPosition,
      setBoxGap,
      addModelToBox,
      removeModelFromBox,
      clearModelsFromBox,
      listModels,
      getBoxDimensions,
      getModelPosition,
      getModelBoundingBoxSize,
      setModelPosition,
      setOnModelLoaded,
      setOnBoxTransform,
      setOnWallSelected,
      setOnWallTransform,
      setOnRoomElementTransform,
      setTransformMode,
      highlightBox,
      setRoomBounds,
      clearRoomBounds,
      setCameraView,
      resetCamera,
      setShowcaseMode,
      getShowcaseMode,
      getCurrentMode,
      setMode,
      renderScene,
      setUltraPerformanceMode,
      getUltraPerformanceMode,
      setUltraPerformanceModeOptions,
      getUltraPerformanceModeOptions,
      createRoom,
      removeRoom,
      selectWallByIndex,
      selectRoomElementById,
      setPlacementMode,
      addDoorToRoom,
      addWindowToRoom,
      setOnRoomElementPlaced,
      setOnRoomElementSelected,
      updateRoomElementConfig,
      setLockEnabled,
      getLockEnabled,
      getCombinedBoundingBox,
      getSelectedBoxDimensions,
      setDimensionsOverlayVisible,
      getDimensionsOverlayVisible,
      getSelectedBoxScreenPosition,
      getRightmostX,
      setManualWallHidden,
      getManualWallHidden,
      createRoomWithDimensions,
      setRoomDimensions,
      addExtraWall,
      setRoomLocked,
      getRoomExists,
      getRoomLocked,
      getRoomDimensions,
      getRoomVisible,
      hideRoom,
      showRoom,
      setPanelEdgesVisible,
      setPanelHidden,
      setHiddenPanels,
      getHiddenPanels,
      setAllPanelsHidden,
      setRoomCeilingVisible,
      setWallEditMode,
      setMousePreset,
      getMousePreset,
      setBackgroundMode,
      getBackgroundMode,
      setMaterialQuality,
      getMaterialQuality,
      setReflectionsEnabled,
      getReflectionsEnabled,
      setPhotoModeEnabled,
      getPhotoModeEnabled,
      capturePhotoDataUrl,
      setExplodedViewEnabled,
      getExplodedViewEnabled,
      setExplodedViewIntensity,
      getExplodedViewIntensity,
    ]
  );
};
