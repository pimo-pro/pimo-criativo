/**
 * pimo-room v4 — wallStore: vista derivada em cm (Z-03.3).
 * SSOT canónico: ProjectState.room = ProjectRoomConfig (mm).
 * Sincronização: RoomEngine.applyProjectRoomToWallStore.
 *
 * Undo/redo fino fica para fases posteriores; aqui usa-se Zustand vanilla
 * já presente no pimo (sem dependência zundo).
 */
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import {
  computeCenteredConnectedLayoutCm,
  isLegacyCornerWallStoreLayout,
} from "../utils/roomCoordinates";
import { wallStoreFootprintCm } from "../3d/viewer-engine/room/roomUnitConversion";

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
  /** Painel de sala (paredes) aberto na UI. */
  isOpen: boolean;
  /** Incrementado em loadRoomConfig/clearRoom para o Workspace recriar a mesh 3D. */
  roomMeshSyncToken: number;
  walls: Wall[];
  selectedWallId: string | null;
  /** Índice da parede principal (0..3). Parede frontal lógica do projecto. */
  mainWallIndex: number;
  createWall: () => void;
  removeWall: (_id: string) => void;
  updateWall: (_id: string, _patch: Partial<Wall>, _options?: { skipSnap?: boolean }) => void;
  selectWall: (_id: string | null) => void;
  setOpen: (_isOpen: boolean) => void;
  setMainWallIndex: (_index: 0 | 1 | 2 | 3) => void;
  /** Recria a sala com 3 paredes padrão (formato em "U"). */
  resetRoom: () => void;
  /** Limpa a sala (sem paredes). */
  clearRoom: () => void;
  setNumWalls: (_n: 3 | 4) => void;
  /** Actualiza comprimentos/altura das paredes existentes (mantém ids e aberturas). */
  updateRoomDimensionsMeters: (_widthM: number, _depthM: number, _heightM: number) => void;
  /** Restaura estado a partir de snapshot (ex.: ao carregar projecto). */
  loadRoomConfig: (_snapshot: {
    walls: Wall[];
    selectedWallId: string | null;
    mainWallIndex?: number;
  } | null) => void;
}

const DEFAULT_WALL: Omit<Wall, "id"> = {
  lengthCm: 300,
  heightCm: 280,
  thicknessCm: 20,
  color: "#d1d5db",
  openings: [],
};

const logWallStore = (event: string, payload?: Record<string, unknown>) => {
  if (!import.meta.env.DEV) return;
  console.info("[wallStore]", event, payload ?? {});
};

const clampMainWallIndex = (index: number, wallsLength: number): 0 | 1 | 2 | 3 => {
  if (wallsLength <= 0) return 0;
  const maxIndex = Math.max(0, Math.min(3, wallsLength - 1));
  return Math.max(0, Math.min(maxIndex, index)) as 0 | 1 | 2 | 3;
};

function computeConnectedLayout(walls: Wall[]): Array<{ x: number; z: number; rotation: number }> {
  return computeCenteredConnectedLayoutCm(walls);
}

export function getRoomDimensionsCm(walls: Wall[]): {
  widthCm: number;
  depthCm: number;
  heightCm: number;
} | null {
  return wallStoreFootprintCm(walls);
}

function applyLayoutIfMissing(walls: Wall[]): Wall[] {
  const layout = computeConnectedLayout(walls);
  return walls.map((wall, index) => {
    const fallback = layout[index] ?? { x: 0, z: 0, rotation: 0 };
    return {
      ...wall,
      position: wall.position ?? { x: fallback.x, z: fallback.z },
      rotation: wall.rotation ?? fallback.rotation,
    };
  });
}

export const wallStore = createStore<WallStoreState>((set, get) => ({
  isOpen: false,
  roomMeshSyncToken: 0,
  walls: [],
  selectedWallId: null,
  mainWallIndex: 0,

  setMainWallIndex: (index) => {
    const { walls } = get();
    const nextMainWallIndex = clampMainWallIndex(index, walls.length);
    const selectedWallId = walls[nextMainWallIndex]?.id ?? null;
    set({ mainWallIndex: nextMainWallIndex, selectedWallId });
  },

  createWall: () => {
    const { walls, selectedWallId } = get();
    const id = `wall-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const offset = walls.length * 25;
    const wall: Wall = {
      id,
      ...DEFAULT_WALL,
      position: { x: offset, z: offset },
      rotation: 0,
      openings: [],
    };
    const newWalls = applyLayoutIfMissing([...walls, wall]);
    set({
      walls: newWalls,
      selectedWallId: selectedWallId ?? id,
    });
  },

  removeWall: (id: string) => {
    const { walls, selectedWallId, mainWallIndex } = get();
    if (!walls.some((w) => w.id === id)) return;
    const nextWalls = walls.filter((wall) => wall.id !== id);
    const nextMainWallIndex = clampMainWallIndex(mainWallIndex, nextWalls.length);
    const nextSelected =
      selectedWallId === id
        ? nextWalls[nextMainWallIndex]?.id ?? nextWalls[0]?.id ?? null
        : selectedWallId;
    set({ walls: nextWalls, selectedWallId: nextSelected, mainWallIndex: nextMainWallIndex });
  },

  updateWall: (id: string, patch: Partial<Wall>, options = {}) => {
    const { walls } = get();
    if (!id || !walls.some((wall) => wall.id === id)) return;
    const nextWalls = walls.map((wall) => (wall.id === id ? { ...wall, ...patch } : wall));
    set({
      walls: options.skipSnap ? nextWalls : applyLayoutIfMissing(nextWalls),
    });
  },

  selectWall: (id: string | null) => {
    set({ selectedWallId: id });
  },

  setOpen: (isOpen: boolean) => {
    set({ isOpen });
  },

  resetRoom: () => {
    const ts = Date.now();
    const w1: Wall = { id: `wall-${ts}-1`, ...DEFAULT_WALL, openings: [] };
    const w2: Wall = { id: `wall-${ts}-2`, ...DEFAULT_WALL, openings: [] };
    const w3: Wall = { id: `wall-${ts}-3`, ...DEFAULT_WALL, openings: [] };
    const withLayout = applyLayoutIfMissing([w1, w2, w3]);
    set({ walls: withLayout, selectedWallId: withLayout[0]?.id ?? null, mainWallIndex: 0 });
  },

  clearRoom: () => {
    set((s) => ({
      walls: [],
      selectedWallId: null,
      mainWallIndex: 0,
      roomMeshSyncToken: s.roomMeshSyncToken + 1,
    }));
  },

  setNumWalls: (n: 3 | 4) => {
    const { walls, mainWallIndex } = get();
    if (n === walls.length) return;
    if (n === 3 && walls.length === 4) {
      const next = walls.slice(0, 3);
      const nextMainWallIndex = clampMainWallIndex(mainWallIndex, next.length);
      set({
        walls: applyLayoutIfMissing(next),
        selectedWallId: next[nextMainWallIndex]?.id ?? next[0]?.id ?? null,
        mainWallIndex: nextMainWallIndex,
      });
      return;
    }
    if (n === 4 && walls.length === 3) {
      const newWall: Wall = { id: `wall-${Date.now()}-4`, ...DEFAULT_WALL, openings: [] };
      set({ walls: applyLayoutIfMissing([...walls, newWall]) });
    }
  },

  updateRoomDimensionsMeters: (widthM, depthM, heightM) => {
    const { walls } = get();
    if (walls.length < 3) return;
    const widthCm = Math.max(50, widthM * 100);
    const depthCm = Math.max(50, depthM * 100);
    const heightCm = Math.max(50, heightM * 100);
    const next = walls.map((wall, index) => {
      let lengthCm = wall.lengthCm;
      if (index === 0 || index === 2) lengthCm = widthCm;
      else if (index === 1 || index === 3) lengthCm = depthCm;
      return { ...wall, lengthCm, heightCm };
    });
    const withLayout = applyLayoutIfMissing(next);
    set({
      walls: withLayout,
      roomMeshSyncToken: get().roomMeshSyncToken + 1,
    });
  },

  loadRoomConfig: (snapshot) => {
    if (!snapshot || !Array.isArray(snapshot.walls) || snapshot.walls.length === 0) {
      logWallStore("clear-or-invalid-room-config", { hasSnapshot: Boolean(snapshot) });
      set((s) => ({
        walls: [],
        selectedWallId: null,
        mainWallIndex: 0,
        roomMeshSyncToken: s.roomMeshSyncToken + 1,
      }));
      return;
    }
    const walls = applyLayoutIfMissing(snapshot.walls);
    const dims = getRoomDimensionsCm(walls);
    const migratedWalls =
      dims && isLegacyCornerWallStoreLayout(walls, dims.widthCm)
        ? walls.map((wall) => ({
            ...wall,
            position: {
              x: (wall.position?.x ?? 0) - dims.widthCm / 2,
              y: wall.position?.y,
              z: (wall.position?.z ?? 0) - dims.depthCm / 2,
            },
          }))
        : walls;
    const mainWallIndex = clampMainWallIndex(snapshot.mainWallIndex ?? 0, migratedWalls.length);
    set({
      walls: migratedWalls,
      selectedWallId:
        snapshot.selectedWallId && migratedWalls.some((w) => w.id === snapshot.selectedWallId)
          ? snapshot.selectedWallId
          : migratedWalls[mainWallIndex]?.id ?? migratedWalls[0]?.id ?? null,
      mainWallIndex,
      roomMeshSyncToken: get().roomMeshSyncToken + 1,
    });
  },
}));

export function useWallStore<T>(selector: (_state: WallStoreState) => T): T {
  return useStore(wallStore, selector);
}
