/**
 * STUB — wallStore vazio (feature/sala-rebuild-opensource).
 * Mantém API para consumidores ainda não limpos; sem geometria de sala.
 */
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";

export interface WallOpening {
  id: string;
  type: "door" | "window";
  kind?: "normal" | "correr";
  widthMm: number;
  heightMm: number;
  thicknessMm?: number;
  floorOffsetMm: number;
  horizontalOffsetMm: number;
  modelId?: string;
}

export interface Wall {
  id: string;
  lengthCm: number;
  heightCm: number;
  thicknessCm: number;
  color: string;
  position?: { x: number; y?: number; z: number };
  rotation?: number;
  openings: WallOpening[];
}

export interface WallStoreState {
  isOpen: boolean;
  roomMeshSyncToken: number;
  walls: Wall[];
  selectedWallId: string | null;
  mainWallIndex: number;
  createWall: () => void;
  removeWall: (_id: string) => void;
  updateWall: (_id: string, _patch: Partial<Wall>, _options?: { skipSnap?: boolean }) => void;
  selectWall: (_id: string | null) => void;
  setOpen: (_isOpen: boolean) => void;
  setMainWallIndex: (_index: 0 | 1 | 2 | 3) => void;
  resetRoom: () => void;
  clearRoom: () => void;
  setNumWalls: (_n: 3 | 4) => void;
  updateRoomDimensionsMeters: (_widthM: number, _depthM: number, _heightM: number) => void;
  loadRoomConfig: (_snapshot: { walls: Wall[]; selectedWallId: string | null; mainWallIndex?: number } | null) => void;
}

export function getRoomDimensionsCm(walls: Wall[]): { widthCm: number; depthCm: number; heightCm: number } | null {
  if (!walls || walls.length < 3) return null;
  const w0 = walls[0]?.lengthCm ?? 0;
  const w1 = walls[1]?.lengthCm ?? w0;
  const w2 = walls[2]?.lengthCm ?? w0;
  const w3 = walls[3]?.lengthCm ?? w1;
  const heightCm = Math.max(...walls.map((w) => w.heightCm || 0), 0);
  return {
    widthCm: Math.max(0, (w0 + w2) / 2),
    depthCm: Math.max(0, (w1 + w3) / 2),
    heightCm,
  };
}

export const wallStore = createStore<WallStoreState>((set, get) => ({
  isOpen: false,
  roomMeshSyncToken: 0,
  walls: [],
  selectedWallId: null,
  mainWallIndex: 0,

  setMainWallIndex: (index) => {
    const walls = get().walls;
    const maxIndex = Math.max(0, Math.min(3, walls.length - 1));
    const next = Math.max(0, Math.min(maxIndex, index)) as 0 | 1 | 2 | 3;
    set({ mainWallIndex: next, selectedWallId: walls[next]?.id ?? null });
  },

  createWall: () => {},

  removeWall: (_id) => {
    void _id;
  },

  updateWall: (_id, _patch, _options) => {
    void _id;
    void _patch;
    void _options;
  },

  selectWall: (id) => set({ selectedWallId: id }),

  setOpen: (isOpen) => set({ isOpen }),

  resetRoom: () => {
    set({ walls: [], selectedWallId: null, mainWallIndex: 0, roomMeshSyncToken: get().roomMeshSyncToken + 1 });
  },

  clearRoom: () => {
    set({ walls: [], selectedWallId: null, mainWallIndex: 0, roomMeshSyncToken: get().roomMeshSyncToken + 1 });
  },

  setNumWalls: (_n) => {
    void _n;
  },

  updateRoomDimensionsMeters: (_widthM, _depthM, _heightM) => {
    void _widthM;
    void _depthM;
    void _heightM;
  },

  loadRoomConfig: (snapshot) => {
    if (!snapshot) {
      set({ walls: [], selectedWallId: null, mainWallIndex: 0, roomMeshSyncToken: get().roomMeshSyncToken + 1 });
      return;
    }
    const walls = snapshot.walls ?? [];
    const mainWallIndex = Math.max(0, Math.min(3, snapshot.mainWallIndex ?? 0));
    set({
      walls,
      selectedWallId:
        snapshot.selectedWallId && walls.some((w) => w.id === snapshot.selectedWallId)
          ? snapshot.selectedWallId
          : walls[mainWallIndex]?.id ?? walls[0]?.id ?? null,
      mainWallIndex,
      roomMeshSyncToken: get().roomMeshSyncToken + 1,
    });
  },
}));

export function useWallStore<T>(selector: (_state: WallStoreState) => T): T {
  return useStore(wallStore, selector);
}
