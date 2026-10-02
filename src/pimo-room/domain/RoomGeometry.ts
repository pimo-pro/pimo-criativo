/**
 * Descritores de geometria (mm) — input do renderer, sem THREE.
 */
import type { OpeningId, RoomState, Vec2Mm, WallId } from "./RoomState";
import { wallLengthMm } from "./RoomState";

export type WallCutoutDesc = {
  openingId: OpeningId;
  offsetAlongWallMm: number;
  widthMm: number;
  heightMm: number;
  sillMm: number;
};

export type WallGeometryDesc = {
  wallId: WallId;
  startMm: Vec2Mm;
  endMm: Vec2Mm;
  heightMm: number;
  thicknessMm: number;
  lengthMm: number;
  cutouts: WallCutoutDesc[];
};

export type RoomGeometryDescriptor = {
  walls: WallGeometryDesc[];
  floorPolygonsMm: Vec2Mm[][];
  ceilingPolygonsMm: Vec2Mm[][];
  levelElevationsMm: Record<string, number>;
  footprintMm: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    widthMm: number;
    depthMm: number;
    heightMm: number;
  };
};

export function computeFootprintFromWalls(
  walls: Array<{ startMm: Vec2Mm; endMm: Vec2Mm }>
): { minX: number; maxX: number; minZ: number; maxZ: number; widthMm: number; depthMm: number } {
  if (walls.length === 0) {
    return { minX: 0, maxX: 0, minZ: 0, maxZ: 0, widthMm: 0, depthMm: 0 };
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const w of walls) {
    minX = Math.min(minX, w.startMm.x, w.endMm.x);
    maxX = Math.max(maxX, w.startMm.x, w.endMm.x);
    minZ = Math.min(minZ, w.startMm.z, w.endMm.z);
    maxZ = Math.max(maxZ, w.startMm.z, w.endMm.z);
  }
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    widthMm: Math.max(0, maxX - minX),
    depthMm: Math.max(0, maxZ - minZ),
  };
}

/** Polígono retangular do footprint (sentido horário no XZ). */
export function footprintRectPolygon(fp: {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}): Vec2Mm[] {
  return [
    { x: fp.minX, z: fp.minZ },
    { x: fp.maxX, z: fp.minZ },
    { x: fp.maxX, z: fp.maxZ },
    { x: fp.minX, z: fp.maxZ },
  ];
}

export function buildRoomGeometry(state: RoomState): RoomGeometryDescriptor {
  const levelId = state.activeLevelId;
  const walls = state.walls.filter((w) => w.levelId === levelId);
  const openings = state.openings.filter((o) => walls.some((w) => w.id === o.wallId));
  const fpWalls = computeFootprintFromWalls(walls);
  const heightMm =
    state.footprint?.heightMm ??
    state.levels.find((l) => l.id === levelId)?.storeyHeightMm ??
    walls[0]?.heightMm ??
    2600;

  const wallDescs: WallGeometryDesc[] = walls.map((wall) => ({
    wallId: wall.id,
    startMm: wall.startMm,
    endMm: wall.endMm,
    heightMm: wall.heightMm,
    thicknessMm: wall.thicknessMm,
    lengthMm: wallLengthMm(wall),
    cutouts: openings
      .filter((o) => o.wallId === wall.id)
      .map((o) => ({
        openingId: o.id,
        offsetAlongWallMm: o.offsetAlongWallMm,
        widthMm: o.widthMm,
        heightMm: o.heightMm,
        sillMm: o.sillMm,
      })),
  }));

  const slabPoly =
    state.slabs.find((s) => s.levelId === levelId)?.polygonMm ?? footprintRectPolygon(fpWalls);
  const ceilPoly =
    state.ceilings.find((c) => c.levelId === levelId)?.polygonMm ?? footprintRectPolygon(fpWalls);

  return {
    walls: wallDescs,
    floorPolygonsMm: slabPoly.length >= 3 ? [slabPoly] : [],
    ceilingPolygonsMm: ceilPoly.length >= 3 ? [ceilPoly] : [],
    levelElevationsMm: { [levelId]: 0 },
    footprintMm: {
      ...fpWalls,
      heightMm,
    },
  };
}
