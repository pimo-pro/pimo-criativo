/**
 * Runtime canónico do Viewer (Z-01.2.6).
 *
 * A superfície pública de produto é `PimoViewerApi`.
 * `window.viewerCore` permanece apenas como ponte de compatibilidade (HMR / dispose),
 * atribuída no Workspace dentro de `setOnViewerReady`.
 *
 * Módulos não-React devem usar `getActiveViewerCore()` / `getActivePimoViewerApi()`,
 * nunca `window.viewerCore`.
 */
import type { PimoViewerApi } from "../../context/PimoViewerContextCore";

export type ViewerCoreRoomManagerRuntime = {
  wallsMain?: unknown[];
  createRoom?: (..._args: unknown[]) => unknown;
  removeRoom?: (..._args: unknown[]) => unknown;
  addDoorToRoom?: (..._args: unknown[]) => unknown;
  addWindowToRoom?: (..._args: unknown[]) => unknown;
  getRoomExists?: () => boolean;
  getRoomDimensions?: () => unknown;
  getRoomVisible?: () => boolean;
  hideRoom?: () => void;
  showRoom?: () => void;
  updateWallFromConfig?: (_config: {
    id: number;
    lengthM: number;
    heightM: number;
    thicknessM: number;
    position: { x: number; y?: number; z: number };
    rotationDeg: number;
  }) => boolean;
  addWallFromConfig?: (_config: {
    id: number;
    lengthM: number;
    heightM: number;
    thicknessM: number;
    position: { x: number; y?: number; z: number };
    rotationDeg: number;
    isMainWall?: boolean;
  }) => unknown;
  updateCamera?: () => void;
  setZones?: (_zones: unknown) => void;
  clearZoneOverlay?: () => void;
};

export type ViewerCoreRuntime = PimoViewerApi & {
  viewerReady?: boolean;
  roomManager?: ViewerCoreRoomManagerRuntime;
  roomBuilder?: {
    toggleElementOpen?: (_elementId: string, _animate?: boolean) => boolean | null;
  };
  viewerState?: { getTransformControlsDragging?: () => boolean };
  setBoxSpacing?: (_spacing: number) => void;
  updateBoxSpacing?: (_spacing: number) => void;
  applyMaterialPreset?: (..._args: unknown[]) => void;
  getCameraPosition?: () => unknown;
  setCameraPosition?: (..._args: unknown[]) => void;
  setCameraZoom?: (..._args: unknown[]) => void;
  getCameraZoom?: () => unknown;
  getBoxIdByMeshPublic?: (_mesh: import("three").Object3D) => string | null;
};

let activeViewerCore: ViewerCoreRuntime | null = null;
let activePimoViewerApi: PimoViewerApi | null = null;

export function setActiveViewerCore(core: ViewerCoreRuntime | null): void {
  activeViewerCore = core;
}

export function getActiveViewerCore(): ViewerCoreRuntime | null {
  return activeViewerCore;
}

export function setActivePimoViewerApi(api: PimoViewerApi | null): void {
  activePimoViewerApi = api;
}

export function getActivePimoViewerApi(): PimoViewerApi | null {
  return activePimoViewerApi;
}
