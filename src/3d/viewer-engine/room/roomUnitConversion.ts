/**
 * Conversão interna de unidades da sala (Z-03.3).
 * SSOT canónico: ProjectRoomConfig (mm).
 * Vistas derivadas: wallStore / roomSnapshot (cm), viewer (m).
 * Não expor API pública nova — consumidores continuam via RoomEngine.
 */
import type { Wall, WallOpening } from "../../../stores/wallStore";
import type { RoomSnapshot } from "../../../context/projectTypes";
import type {
  ProjectRoomConfig,
  ProjectRoomOpening,
  ProjectRoomWall,
} from "./roomEngineTypes";
import {
  WALL_INDEX_TO_LABEL,
  WALL_LABEL_TO_INDEX,
} from "./roomEngineTypes";

export const MM_PER_CM = 10;
export const MM_PER_M = 1000;

export function mmToCm(mm: number): number {
  return mm / MM_PER_CM;
}

export function cmToMm(cm: number): number {
  return cm * MM_PER_CM;
}

export function mmToM(mm: number): number {
  return mm / MM_PER_M;
}

export function mToMm(m: number): number {
  return m * MM_PER_M;
}

/** Footprint interior coerente com `getRoomDimensionsCm` (média das paredes opostas). */
export function wallStoreFootprintMm(
  walls: Wall[]
): { widthMm: number; depthMm: number; heightMm: number } | null {
  if (!walls || walls.length < 3) return null;
  const w0 = walls[0]?.lengthCm ?? 0;
  const w2 = walls[2]?.lengthCm ?? w0;
  const w1 = walls[1]?.lengthCm ?? 0;
  const w3 = walls[3]?.lengthCm ?? w1;
  const widthMm = cmToMm((w0 + w2) / 2);
  const depthMm = cmToMm((w1 + w3) / 2);
  const heightMm = Math.max(
    ...walls.map((w) => cmToMm(w.heightCm ?? 0)),
    2600
  );
  return { widthMm, depthMm, heightMm };
}

export function wallStoreFootprintCm(walls: Wall[]): {
  widthCm: number;
  depthCm: number;
  heightCm: number;
} | null {
  const fp = wallStoreFootprintMm(walls);
  if (!fp) return null;
  return {
    widthCm: mmToCm(fp.widthMm),
    depthCm: mmToCm(fp.depthMm),
    heightCm: mmToCm(fp.heightMm),
  };
}

/** Vista derivada wallStore (cm) a partir do SSOT mm. */
export function projectRoomToWallStoreWalls(room: ProjectRoomConfig): Wall[] {
  return room.walls
    .slice()
    .sort((a, b) => WALL_LABEL_TO_INDEX[a.label] - WALL_LABEL_TO_INDEX[b.label])
    .map((wall) => {
      const openings: WallOpening[] = room.openings
        .filter((o) => o.wallId === wall.id)
        .map((o) => ({
          id: o.id,
          type: o.type,
          kind: o.kind,
          widthMm: o.widthMm,
          heightMm: o.heightMm,
          thicknessMm: o.thicknessMm,
          floorOffsetMm: o.floorOffsetMm ?? o.verticalOffsetMm,
          horizontalOffsetMm: o.xPosMm ?? o.horizontalOffsetMm,
        }));
      const widthMm = wall.widthMm ?? wall.lengthMm;
      return {
        id: wall.id,
        lengthCm: mmToCm(widthMm),
        heightCm: mmToCm(wall.heightMm),
        thicknessCm: mmToCm(wall.thicknessMm),
        color: "#d1d5db",
        openings,
        position: {
          x: mmToCm(wall.position.x),
          y: mmToCm(wall.position.y ?? wall.heightMm / 2),
          z: mmToCm(wall.position.z),
        },
        rotation: wall.rotationDeg,
      };
    });
}

export type WallStoreRoomExtras = Partial<
  Pick<ProjectRoomConfig, "locked" | "visible" | "floorMode" | "ceilingVisible" | "hiddenWalls" | "utilities">
>;

const DEFAULT_DOOR_THICKNESS_MM = 40;
const DEFAULT_WINDOW_THICKNESS_MM = 40;

/** Reconstrói ProjectRoomConfig a partir de wallStore (cm). Requer ≥4 paredes canónicas. */
export function wallStoreToProjectRoom(
  walls: Wall[],
  extras?: WallStoreRoomExtras
): ProjectRoomConfig | null {
  if (!walls || walls.length < 4) return null;
  const sorted = [...walls];
  const footprint = wallStoreFootprintMm(sorted);
  if (!footprint) return null;
  const { widthMm, depthMm, heightMm } = footprint;
  const wallThicknessMm = cmToMm(sorted[0]?.thicknessCm ?? 20);
  const projectWalls: ProjectRoomWall[] = sorted.map((wall, index) => ({
    id: wall.id,
    label: WALL_INDEX_TO_LABEL[index] ?? "extra",
    widthMm: cmToMm(wall.lengthCm ?? 0),
    lengthMm: cmToMm(wall.lengthCm ?? 0),
    heightMm: cmToMm(wall.heightCm ?? 0),
    thicknessMm: cmToMm(wall.thicknessCm ?? 20),
    position: {
      x: cmToMm(wall.position?.x ?? 0),
      y: cmToMm(wall.position?.y ?? (wall.heightCm ?? 0) / 2),
      z: cmToMm(wall.position?.z ?? 0),
    },
    rotationDeg: wall.rotation ?? 0,
  }));
  const openings: ProjectRoomOpening[] = [];
  sorted.forEach((wall) => {
    for (const o of wall.openings ?? []) {
      openings.push({
        id: o.id,
        type: o.type,
        kind: o.kind ?? "normal",
        wallId: wall.id,
        xPosMm: o.horizontalOffsetMm,
        horizontalOffsetMm: o.horizontalOffsetMm,
        widthMm: o.widthMm,
        heightMm: o.heightMm,
        thicknessMm:
          o.thicknessMm ??
          (o.type === "window" ? DEFAULT_WINDOW_THICKNESS_MM : DEFAULT_DOOR_THICKNESS_MM),
        floorOffsetMm: o.floorOffsetMm,
        verticalOffsetMm: o.floorOffsetMm,
      });
    }
  });
  return {
    widthMm,
    depthMm,
    heightMm,
    wallThicknessMm,
    locked: extras?.locked ?? false,
    visible: extras?.visible !== false,
    floorMode: extras?.floorMode ?? "room",
    ceilingVisible: extras?.ceilingVisible !== false,
    hiddenWalls: Array.isArray(extras?.hiddenWalls)
      ? extras.hiddenWalls.filter((id) => projectWalls.some((wall) => wall.id === id))
      : [],
    walls: projectWalls,
    openings,
    utilities: Array.isArray(extras?.utilities) ? extras.utilities : [],
  };
}

export type RoomSnapshotUiState = {
  selectedWallId: string | null;
  mainWallIndex: number;
};

/** Vista derivada roomSnapshot (cm) a partir do SSOT mm. */
export function projectRoomToRoomSnapshot(
  room: ProjectRoomConfig,
  ui: RoomSnapshotUiState
): RoomSnapshot {
  const walls = projectRoomToWallStoreWalls(room);
  const mainWallIndex = Math.max(0, Math.min(3, ui.mainWallIndex ?? 0));
  const selectedWallId =
    ui.selectedWallId && walls.some((w) => w.id === ui.selectedWallId)
      ? ui.selectedWallId
      : walls[mainWallIndex]?.id ?? walls[0]?.id ?? null;
  return {
    walls: walls.map((wall) => ({
      ...wall,
      openings: (wall.openings ?? []).map((opening) => ({ ...opening })),
    })),
    selectedWallId,
    mainWallIndex,
  };
}

/** Payload para `wallStore.loadRoomConfig` derivado do SSOT. */
export function deriveWallStoreConfigFromProjectRoom(
  room: ProjectRoomConfig,
  ui?: Partial<RoomSnapshotUiState>
): { walls: Wall[]; selectedWallId: string | null; mainWallIndex: number } {
  const walls = projectRoomToWallStoreWalls(room);
  const mainWallIndex = Math.max(0, Math.min(3, ui?.mainWallIndex ?? 0));
  const selectedWallId =
    ui?.selectedWallId && walls.some((w) => w.id === ui.selectedWallId)
      ? ui.selectedWallId
      : walls[mainWallIndex]?.id ?? walls[0]?.id ?? null;
  return { walls, selectedWallId, mainWallIndex };
}
