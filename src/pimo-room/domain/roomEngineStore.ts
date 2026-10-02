/**
 * Store do RoomEngine (multi-level + catálogo + AI) — separado de ProjectRoomConfig.
 */
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import type { RoomState } from "./RoomState";
import { createEmptyRoomState } from "./RoomState";
import type { VerticalConnection } from "./levels/RoomLevelState";
import type { AiPresetId } from "./ai/AiPresets";
import type { AiPreviewKind } from "./ai/AiEngine";
import type {
  Object3D,
  PerspectiveCamera,
  Scene,
} from "three";

/**
 * Operações públicas mínimas consumidas pelo RoomEngine.
 * Estruturais: não dependem de PimoViewerApi ou ViewerCore.
 */
export type RoomEngineOpeningConfig = {
  widthMm: number;
  heightMm: number;
  thicknessMm?: number;
  kind?: "normal" | "correr";
  floorOffsetMm: number;
  horizontalOffsetMm: number;
};

export type RoomEngineViewerApi = {
  updateRoomElementConfig?: (
    _elementId: string,
    _config: RoomEngineOpeningConfig
  ) => boolean;
  addDoorToRoom?: (
    _wallId: number,
    _config: RoomEngineOpeningConfig,
    _elementId?: string
  ) => string;
  addWindowToRoom?: (
    _wallId: number,
    _config: RoomEngineOpeningConfig,
    _elementId?: string
  ) => string;
  selectRoomElementById?: (_elementId: string | null) => void;
  viewerState?: {
    getSelectedRoomElementId?: () => string | null;
  };
};

/**
 * Superfície estrutural necessária pelos hosts WebGL da sala.
 * Não depende da classe concreta ViewerCore.
 */
export type RoomEngineViewerHost = RoomEngineViewerApi & {
  cameraManager?: {
    camera: PerspectiveCamera;
  };
  controls?: {
    controls: {
      enabled: boolean;
    };
  };
  rendererManager?: {
    renderer: {
      domElement: HTMLElement;
    };
  };
  sceneManager?: {
    scene: Scene;
    root?: Object3D;
  };
  roomBuilder?: {
    toggleElementOpen?: (_elementId: string) => boolean | null;
  };
};

export type RoomEngineViewerFallback = {
  getHost: () => RoomEngineViewerHost | null;
  getApi: () => RoomEngineViewerApi | null;
};

let injectedRoomViewerHost: RoomEngineViewerHost | null = null;
let roomViewerFallback: RoomEngineViewerFallback | null = null;

/** Injeta explicitamente a superfície viewer usada pelos hosts da sala. */
export function setRoomEngineViewerHost(
  host: RoomEngineViewerHost | null
): void {
  injectedRoomViewerHost = host;
}

/** Configura compatibilidade externa sem importar o runtime do viewer. */
export function setRoomEngineViewerFallback(
  fallback: RoomEngineViewerFallback | null
): void {
  roomViewerFallback = fallback;
}

/** Host WebGL da sala, com fallback para o runtime canónico atual. */
export function getRoomEngineViewerHost(): RoomEngineViewerHost | null {
  return injectedRoomViewerHost ?? roomViewerFallback?.getHost() ?? null;
}

/** API da sala, com a mesma ordem de fallback existente. */
export function getRoomEngineViewerApi(): RoomEngineViewerApi | null {
  return (
    injectedRoomViewerHost ??
    roomViewerFallback?.getApi() ??
    roomViewerFallback?.getHost() ??
    null
  );
}

/** @deprecated Usar setRoomEngineViewerHost. */
export function setRoomViewerCore(host: RoomEngineViewerHost | null): void {
  setRoomEngineViewerHost(host);
}

/** @deprecated Usar getRoomEngineViewerHost. */
export function getRoomViewerCore(): RoomEngineViewerHost | null {
  return getRoomEngineViewerHost();
}

/** @deprecated Usar getRoomEngineViewerApi. */
export function getRoomViewerApi(): RoomEngineViewerApi | null {
  return getRoomEngineViewerApi();
}

export type RoomEngineStoreState = {
  roomState: RoomState | null;
  verticalConnections: VerticalConnection[];
  walkthroughActive: boolean;
  slabEditOpen: boolean;
  selectedItemId: string | null;
  /** Preview AI pendente (ghost). */
  aiPreviewState: RoomState | null;
  aiPreviewKind: AiPreviewKind;
  aiAffectedIds: string[];
  aiStyleId: AiPresetId;
  setRoomState: (_state: RoomState | null) => void;
  patchRoomState: (_fn: (_s: RoomState) => RoomState) => void;
  setVerticalConnections: (_c: VerticalConnection[]) => void;
  setWalkthroughActive: (_v: boolean) => void;
  setSlabEditOpen: (_v: boolean) => void;
  setSelectedItemId: (_id: string | null) => void;
  setAiPreview: (_preview: RoomState | null, _kind?: AiPreviewKind, _affected?: string[]) => void;
  setAiStyleId: (_id: AiPresetId) => void;
  clearAiPreview: () => void;
  reset: () => void;
};

export const roomEngineStore = createStore<RoomEngineStoreState>((set, get) => ({
  roomState: null,
  verticalConnections: [],
  walkthroughActive: false,
  slabEditOpen: false,
  selectedItemId: null,
  aiPreviewState: null,
  aiPreviewKind: null,
  aiAffectedIds: [],
  aiStyleId: "moderno",
  setRoomState: (roomState) => set({ roomState }),
  patchRoomState: (fn) => {
    const cur = get().roomState ?? createEmptyRoomState();
    set({ roomState: fn(cur) });
  },
  setVerticalConnections: (verticalConnections) => set({ verticalConnections }),
  setWalkthroughActive: (walkthroughActive) => set({ walkthroughActive }),
  setSlabEditOpen: (slabEditOpen) => set({ slabEditOpen }),
  setSelectedItemId: (selectedItemId) => set({ selectedItemId }),
  setAiPreview: (aiPreviewState, kind = null, affected = []) =>
    set({
      aiPreviewState,
      aiPreviewKind: kind,
      aiAffectedIds: affected,
    }),
  setAiStyleId: (aiStyleId) => set({ aiStyleId }),
  clearAiPreview: () =>
    set({ aiPreviewState: null, aiPreviewKind: null, aiAffectedIds: [] }),
  reset: () =>
    set({
      roomState: null,
      verticalConnections: [],
      walkthroughActive: false,
      slabEditOpen: false,
      selectedItemId: null,
      aiPreviewState: null,
      aiPreviewKind: null,
      aiAffectedIds: [],
      aiStyleId: "moderno",
    }),
}));

export function useRoomEngineStore<T>(selector: (_s: RoomEngineStoreState) => T): T {
  return useStore(roomEngineStore, selector);
}
