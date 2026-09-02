/**
 * STUB — conversão mm/cm mínima (feature/sala-rebuild-opensource).
 * Sem mesh 3D; mantém contratos de persistência / RoomEngine.
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

export function wallStoreFootprintMm(walls: Wall[]): {
  widthMm: number;
  depthMm: number;
  heightMm: number;
} | null {
  const cm = wallStoreFootprintCm(walls);
  if (!cm) return null;
  return {
    widthMm: cmToMm(cm.widthCm),
    depthMm: cmToMm(cm.depthCm),
    heightMm: cmToMm(cm.heightCm),
  };
}

export function wallStoreFootprintCm(walls: Wall[]): {
  widthCm: number;
  depthCm: number;
  heightCm: number;
} | null {
  if (!walls || walls.length < 3) return null;
  const w0 = walls[0]?.lengthCm ?? 0;
  const w1 = walls[1]?.lengthCm ?? w0;
  const w2 = walls[2]?.lengthCm ?? w0;
  const w3 = walls[3]?.lengthCm ?? w1;
  return {
    widthCm: Math.max(0, (w0 + w2) / 2),
    depthCm: Math.max(0, (w1 + w3) / 2),
    heightCm: Math.max(...walls.map((w) => w.heightCm || 0), 0),
  };
}

export function projectRoomToWallStoreWalls(room: ProjectRoomConfig): Wall[] {
  return (room.walls ?? []).map((wall) => {
    const openings: WallOpening[] = (room.openings ?? [])
      .filter((o) => o.wallId === wall.id)
      .map((o) => ({
        id: o.id,
        type: o.type,
        kind: o.kind,
        widthMm: o.widthMm,
        heightMm: o.heightMm,
        thicknessMm: o.thicknessMm,
        floorOffsetMm: o.floorOffsetMm,
        horizontalOffsetMm: o.horizontalOffsetMm,
      }));
    return {
      id: wall.id,
      lengthCm: mmToCm(wall.widthMm || wall.lengthMm || 0),
      heightCm: mmToCm(wall.heightMm || 0),
      thicknessCm: mmToCm(wall.thicknessMm || 0),
      color: "#d1d5db",
      position: {
        x: mmToCm(wall.position?.x ?? 0),
        y: mmToCm(wall.position?.y ?? 0),
        z: mmToCm(wall.position?.z ?? 0),
      },
      rotation: wall.rotationDeg ?? 0,
      openings,
    };
  });
}

export type WallStoreRoomExtras = Partial<{
  selectedWallId: string | null;
  mainWallIndex: number;
  locked: boolean;
  visible: boolean;
  floorMode: ProjectRoomConfig["floorMode"];
  ceilingVisible: boolean;
  hiddenWalls: string[];
  utilities: ProjectRoomConfig["utilities"];
}>;

export function wallStoreToProjectRoom(
  walls: Wall[],
  extras?: WallStoreRoomExtras
): ProjectRoomConfig | null {
  if (!walls || walls.length < 4) return null;
  const footprint = wallStoreFootprintMm(walls);
  if (!footprint) return null;
  const projectWalls: ProjectRoomWall[] = walls.slice(0, 4).map((wall, index) => {
    const label = WALL_INDEX_TO_LABEL[index] ?? "extra";
    return {
      id: wall.id,
      label,
      widthMm: cmToMm(wall.lengthCm),
      lengthMm: cmToMm(wall.lengthCm),
      heightMm: cmToMm(wall.heightCm),
      thicknessMm: cmToMm(wall.thicknessCm),
      position: {
        x: cmToMm(wall.position?.x ?? 0),
        y: cmToMm(wall.position?.y ?? 0),
        z: cmToMm(wall.position?.z ?? 0),
      },
      rotationDeg: wall.rotation ?? 0,
    };
  });
  const openings: ProjectRoomOpening[] = walls.flatMap((wall) =>
    (wall.openings ?? []).map((o) => ({
      id: o.id,
      type: o.type,
      kind: o.kind ?? "normal",
      wallId: wall.id,
      xPosMm: o.horizontalOffsetMm,
      horizontalOffsetMm: o.horizontalOffsetMm,
      widthMm: o.widthMm,
      heightMm: o.heightMm,
      thicknessMm: o.thicknessMm ?? 40,
      floorOffsetMm: o.floorOffsetMm,
      verticalOffsetMm: o.floorOffsetMm,
    }))
  );
  return {
    widthMm: footprint.widthMm,
    depthMm: footprint.depthMm,
    heightMm: footprint.heightMm,
    wallThicknessMm: cmToMm(walls[0]?.thicknessCm ?? 20),
    locked: extras?.locked === true,
    visible: extras?.visible !== false,
    floorMode: extras?.floorMode ?? "room",
    ceilingVisible: extras?.ceilingVisible !== false,
    hiddenWalls: extras?.hiddenWalls ?? [],
    walls: projectWalls,
    openings,
    utilities: extras?.utilities ?? [],
  };
}

export type RoomSnapshotUiState = {
  selectedWallId: string | null;
  mainWallIndex: number;
};

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

void WALL_LABEL_TO_INDEX;
