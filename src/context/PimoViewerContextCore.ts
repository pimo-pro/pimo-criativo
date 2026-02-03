import { createContext } from "react";
import type { BoxOptions } from "../3d/objects/BoxBuilder";
import type {
  DoorWindowConfig,
  RoomConfig,
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
  createRoom?: (_config: RoomConfig) => void;
  removeRoom?: () => void;
  setPlacementMode?: (_mode: "door" | "window" | null) => void;
  addDoorToRoom?: (_wallId: number, _config: DoorWindowConfig) => string;
  addWindowToRoom?: (_wallId: number, _config: DoorWindowConfig) => string;
  setOnRoomElementPlaced?: (
    _cb: ((_wallId: number, _config: DoorWindowConfig, _type: "door" | "window") => void) | null
  ) => void;
  setOnRoomElementSelected?: (
    _cb: ((_data: { elementId: string; wallId: number; type: "door" | "window"; config: DoorWindowConfig } | null) => void) | null
  ) => void;
  updateRoomElementConfig?: (_elementId: string, _config: DoorWindowConfig) => boolean;
  setExplodedView?: (_enabled: boolean) => void;
  getExplodedView?: () => boolean;
};

export type PimoViewerContextValue = {
  viewerApi: PimoViewerApi | null;
  registerViewerApi: (_api: PimoViewerApi | null) => void;
};

export const PimoViewerContext = createContext<PimoViewerContextValue | null>(null);
