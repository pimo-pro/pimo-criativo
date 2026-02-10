import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { computeWallEndpoints, distance, type Point } from "../utils/wallSnapping";

/**
 * Estado da sala (wallStore) e layout (computeConnectedLayout) estão desenhados para expansão:
 * - Novos campos em Wall/WallOpening podem ser opcionais para compatibilidade.
 * - loadRoomConfig/snapshot já persistem walls + selectedWallId; RoomConfig no projeto idem.
 * - Alterações futuras (materiais, mais aberturas, regras) devem manter esta interface estável.
 */

export interface WallOpening {
  id: string;
  type: "door" | "window";
  widthMm: number;
  heightMm: number;
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
  position?: { x: number; z: number };
  rotation?: number;
  openings: WallOpening[];
}

export interface WallStoreState {
  isOpen: boolean;
  walls: Wall[];
  selectedWallId: string | null;
  /** Índice da parede principal (0..3). Parede onde se constrói a cozinha = "frente" lógica. Default 0. */
  mainWallIndex: number;
  snapEnabled: boolean;
  snapThreshold: number;
  createWall: () => void;
  removeWall: (id: string) => void;
  updateWall: (id: string, patch: Partial<Wall>, options?: { skipSnap?: boolean }) => void;
  selectWall: (id: string | null) => void;
  setOpen: (isOpen: boolean) => void;
  /** Define qual parede é a parede frontal (principal) do projeto. */
  setMainWallIndex: (index: 0 | 1 | 2 | 3) => void;
  toggleSnap: () => void;
  applySnapping: (wallId: string) => void;
  /** Recria a sala com 3 paredes padrão (formato em "U"). */
  resetRoom: () => void;
  /** Limpa a sala (sem paredes). */
  clearRoom: () => void;
  /** Define numWalls (3 ou 4); ajusta lista de paredes se necessário. */
  setNumWalls: (n: 3 | 4) => void;
  /** Restaura estado a partir de snapshot (ex.: ao carregar projeto). */
  loadRoomConfig: (snapshot: { walls: Wall[]; selectedWallId: string | null; mainWallIndex?: number } | null) => void;
}

const DEFAULT_WALL: Omit<Wall, "id"> = {
  lengthCm: 300,
  heightCm: 280,
  thicknessCm: 12,
  color: "#d1d5db",
  openings: [],
};

/**
 * Layout alinhado à origem da sala (0,0). Piso = [0→W]×[0→D] em cm.
 * Posições são centros de cada parede; em metros ficam [0→width]×[0→depth].
 * Frontal: (0,0)→(W,0); Traseira: (0,D)→(W,D); Esquerda: (0,0)→(0,D); Direita: (W,0)→(W,D).
 */
function computeConnectedLayout(walls: Wall[]): Array<{ x: number; z: number; rotation: number }> {
  if (walls.length === 0) return [];
  const n = Math.min(4, walls.length);
const lengths = walls.map((wall) => wall.lengthCm ?? DEFAULT_WALL.lengthCm);
  const L0 = lengths[0];
  const L1 = lengths[1] ?? L0;
  const W = L0;
  const D = L1;

  const layout: Array<{ x: number; z: number; rotation: number }> = [];
  if (n >= 1) layout.push({ x: W / 2, z: 0, rotation: 0 });
  if (n >= 2) layout.push({ x: W, z: D / 2, rotation: 90 });
  if (n >= 3) layout.push({ x: W / 2, z: D, rotation: 0 });
  if (n >= 4) layout.push({ x: 0, z: D / 2, rotation: 90 });
  return layout;
}

export function getRoomDimensionsCm(walls: Wall[]): { widthCm: number; depthCm: number; heightCm: number } | null {
  if (!walls || walls.length < 3) return null;
  const w0 = walls[0]?.lengthCm ?? DEFAULT_WALL.lengthCm;
  const w2 = walls[2]?.lengthCm ?? w0;
  const w1 = walls[1]?.lengthCm ?? w0;
  const w3 = walls[3]?.lengthCm ?? w1;
  const widthCm = (w0 + w2) / 2;
  const depthCm = (w1 + w3) / 2;
  const heightCm = Math.max(...walls.map((w) => w.heightCm ?? DEFAULT_WALL.heightCm), DEFAULT_WALL.heightCm);
  return { widthCm, depthCm, heightCm };
}

function applyLayoutIfMissing(walls: Wall[]): Wall[] {
  const layout = computeConnectedLayout(walls);
  return walls.map((wall, index) => {
    const fallback = layout[index] ?? { x: 0, z: 0, rotation: 0 };
    return {
      ...wall,
      position: { x: fallback.x, z: fallback.z },
      rotation: fallback.rotation,
    };
  });
}

let isSnapping = false;

export const wallStore = createStore<WallStoreState>((set, get) => ({
  isOpen: true,
  walls: [],
  selectedWallId: null,
  mainWallIndex: 0,
  snapEnabled: true,
  snapThreshold: 10,

  setMainWallIndex: (index) => {
    set({ mainWallIndex: Math.max(0, Math.min(3, index)) as 0 | 1 | 2 | 3 });
  },

  createWall: () => {
    const { walls, selectedWallId } = get();
    if (walls.length >= 4) return;
    const id = `wall-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const wall: Wall = { id, ...DEFAULT_WALL };
    const newWalls = applyLayoutIfMissing([...walls, wall]);
    set({
      walls: newWalls,
      selectedWallId: selectedWallId ?? id,
    });
  },

  /** Remove parede sempre por wall.id (nunca por índice). Preserva ordem das restantes e recalcula layout. */
  removeWall: (id: string) => {
    const { walls, selectedWallId } = get();
    if (!walls.some((w) => w.id === id)) return;
    const nextWalls = applyLayoutIfMissing(walls.filter((wall) => wall.id !== id));
    const nextSelected =
      selectedWallId === id
        ? nextWalls[0]?.id ?? null
        : selectedWallId;
    set({ walls: nextWalls, selectedWallId: nextSelected });
  },

  updateWall: (id: string, patch: Partial<Wall>, options = {}) => {
    const { walls } = get();
    const nextWalls = walls.map((wall) =>
      wall.id === id ? { ...wall, ...patch } : wall
    );
    set({ walls: applyLayoutIfMissing(nextWalls) });
    void options;
  },

  selectWall: (id: string | null) => {
    set({ selectedWallId: id });
  },

  setOpen: (isOpen: boolean) => {
    set({ isOpen });
  },

  toggleSnap: () => {
    set((state) => ({ snapEnabled: !state.snapEnabled }));
  },

  applySnapping: (wallId: string) => {
    const state = get();
    const { walls, snapEnabled, snapThreshold } = state;
    if (!snapEnabled || isSnapping) return;

    const wall = walls.find((item) => item.id === wallId);
    if (!wall) return;

    const current = computeWallEndpoints(wall);
    type SnapPair = { from: Point; to: Point };
    let bestSnap: SnapPair | null = null;
    let bestDistance = Infinity;

    walls.forEach((other) => {
      if (other.id === wallId) return;
      const target = computeWallEndpoints(other);
      const pairs: SnapPair[] = [
        { from: current.start, to: target.start },
        { from: current.start, to: target.end },
        { from: current.end, to: target.start },
        { from: current.end, to: target.end },
      ];
      pairs.forEach((pair) => {
        const dist = distance(pair.from, pair.to);
        if (dist < bestDistance && dist <= snapThreshold) {
          bestDistance = dist;
          bestSnap = pair;
        }
      });
    });

if (bestSnap !== null) {
      const dx = bestSnap.to.x - bestSnap.from.x;
      const dz = bestSnap.to.z - bestSnap.from.z;
      isSnapping = true;
      get().updateWall(
        wallId,
        { position: { x: (wall.position?.x ?? 0) + dx, z: (wall.position?.z ?? 0) + dz } },
        { skipSnap: true }
      );
      isSnapping = false;
    }
  },

  resetRoom: () => {
    set({ walls: [], selectedWallId: null });
    const w1: Wall = { id: `wall-${Date.now()}-1`, ...DEFAULT_WALL, openings: [] };
    const w2: Wall = { id: `wall-${Date.now()}-2`, ...DEFAULT_WALL, openings: [] };
    const w3: Wall = { id: `wall-${Date.now()}-3`, ...DEFAULT_WALL, openings: [] };
    const withLayout = applyLayoutIfMissing([w1, w2, w3]);
    set({ walls: withLayout, selectedWallId: withLayout[0]?.id ?? null });
  },
  clearRoom: () => {
    set({ walls: [], selectedWallId: null });
  },

  setNumWalls: (n: 3 | 4) => {
    const { walls } = get();
    if (n === walls.length) return;
    if (n === 3 && walls.length === 4) {
      const next = walls.slice(0, 3);
      set({ walls: applyLayoutIfMissing(next), selectedWallId: next[0]?.id ?? null });
      return;
    }
    if (n === 4 && walls.length === 3) {
      const newWall: Wall = { id: `wall-${Date.now()}-4`, ...DEFAULT_WALL, openings: [] };
      set({ walls: applyLayoutIfMissing([...walls, newWall]) });
    }
  },

  loadRoomConfig: (snapshot) => {
    if (!snapshot || !Array.isArray(snapshot.walls) || snapshot.walls.length === 0) return;
    const walls = applyLayoutIfMissing(snapshot.walls);
    const mainWallIndex = Math.max(0, Math.min(3, (snapshot as { mainWallIndex?: number }).mainWallIndex ?? 0)) as 0 | 1 | 2 | 3;
    set({
      walls,
      selectedWallId: snapshot.selectedWallId && walls.some((w) => w.id === snapshot.selectedWallId)
        ? snapshot.selectedWallId
        : walls[0]?.id ?? null,
      mainWallIndex,
    });
  },
}));

export function useWallStore<T>(selector: (state: WallStoreState) => T): T {
  return useStore(wallStore, selector);
}
