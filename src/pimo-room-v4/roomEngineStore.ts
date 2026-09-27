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
