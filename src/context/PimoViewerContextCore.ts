import { createContext } from "react";
import type { BoxOptions } from "../3d/objects/BoxBuilder";
import type {
  DoorWindowConfig,
  RoomConfig,
  UltraPerformanceModeOptions,
  ViewerMaterialQuality,
  ViewerMousePreset,
  ViewerBackgroundMode,
  ViewerRenderOptions,
  ViewerRenderResult,
} from "./projectTypes";
import type { Viewer } from "../3d/core/Viewer";

export type PimoViewerApi = {
  viewerRef: React.MutableRefObject<Viewer | null>;
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
  setOnBoxSelected: (_callback: (_id: string | null) => void) => void;
  setOnModelLoaded: (_callback: ((_boxId: string, _modelId: string, _object: unknown) => void) | null) => void;
  setOnBoxTransform: (_callback: ((_boxId: string, _position: { x: number; y: number; z: number }, _rotationY: number) => void) | null) => void;
  setTransformMode: (_mode: "translate" | "rotate" | null) => void;
  selectBox?: (_id: string | null) => void;
  highlightBox?: (_id: string | null) => void;
  /** Ativa/desativa modo Apresentação Realista (DOF, bloom, foco automático). turntable = rotação lenta opcional. */
  setShowcaseMode?: (_active: boolean, _turntable?: boolean) => void;
  getShowcaseMode?: () => boolean;
  getCurrentMode?: () => "performance" | "showcase";
  setMode?: (_mode: "performance" | "showcase", _turntable?: boolean) => void;
  renderScene?: (_options: ViewerRenderOptions) => Promise<ViewerRenderResult | null>;
  setUltraPerformanceMode?: (_active: boolean) => void;
  getUltraPerformanceMode?: () => boolean;
  setUltraPerformanceModeOptions?: (_options: UltraPerformanceModeOptions) => void;
  getUltraPerformanceModeOptions?: () => UltraPerformanceModeOptions;
  createRoom?: (_config: RoomConfig) => void;
  removeRoom?: () => void;
  setRoomBounds?: (_bounds: {
    width: number;
    depth: number;
    height: number;
    originX?: number;
    originZ?: number;
  }) => void;
  clearRoomBounds?: () => void;
  /** Seleciona parede por índice (para sincronizar lista do painel com viewer). */
  selectWallByIndex?: (_index: number | null) => void;
  /** Seleciona abertura (porta/janela) por id para mover/rodar com botões do topo. */
  selectRoomElementById?: (_elementId: string | null) => void;
  setPlacementMode?: (_mode: "door" | "window" | null) => void;
  addDoorToRoom?: (_wallId: number, _config: DoorWindowConfig) => string;
  addWindowToRoom?: (_wallId: number, _config: DoorWindowConfig) => string;
  setOnRoomElementPlaced?: (
    _cb: ((_wallId: number, _config: DoorWindowConfig, _type: "door" | "window") => void) | null
  ) => void;
  setOnRoomElementSelected?: (
    _cb: ((_data: { elementId: string; wallId: number; type: "door" | "window"; config: DoorWindowConfig } | null) => void) | null
  ) => void;
  setOnWallSelected?: (_cb: ((_wallId: number | null) => void) | null) => void;
  setOnWallTransform?: (_cb: ((_wallIndex: number, _position: { x: number; z: number }, _rotation: number) => void) | null) => void;
  setOnRoomElementTransform?: (_cb: ((_elementId: string, _config: DoorWindowConfig) => void) | null) => void;
  updateRoomElementConfig?: (_elementId: string, _config: DoorWindowConfig) => boolean;
  setLockEnabled?: (_enabled: boolean) => void;
  getLockEnabled?: () => boolean;
  getCombinedBoundingBox?: () => { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number }; size: { x: number; y: number; z: number }; width: number; height: number; depth: number } | null;
  getSelectedBoxDimensions?: () => { width: number; height: number; depth: number } | null;
  setDimensionsOverlayVisible?: (_visible: boolean) => void;
  getDimensionsOverlayVisible?: () => boolean;
  /** Posição em pixels (relativa ao container) do topo da caixa selecionada, para overlay de texto. */
  getSelectedBoxScreenPosition?: () => { x: number; y: number } | null;
  getRightmostX?: () => number;
  /** Reposiciona a câmera numa vista pré-definida (top, bottom, front, back, right, left, isometric). */
  setCameraView?: (_preset: "top" | "bottom" | "front" | "back" | "right" | "left" | "isometric") => void;
  /** Reposiciona a câmera para o enquadramento padrão. */
  resetCamera?: () => void;
  /** Esconde/mostra manualmente uma parede (auto-hide continua ativo). */
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

export type PimoViewerContextValue = {
  viewerApi: PimoViewerApi | null;
  registerViewerApi: (_api: PimoViewerApi | null) => void;
};

export const PimoViewerContext = createContext<PimoViewerContextValue | null>(null);
