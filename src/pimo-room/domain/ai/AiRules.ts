/**
 * Regras espaciais do RoomEngine AI (mm).
 */
import type { CatalogItemState } from "../catalog/CatalogItemState";
import { getCatalogPreset } from "../catalog/CatalogPresets";
import { computeFootprintFromWalls } from "../RoomGeometry";
import type { RoomState, RoomWall, Vec2Mm } from "../RoomState";
import { wallLengthMm } from "../RoomState";

export type AiBoundsMm = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type AiItemFootprint = {
  id: string;
  type: string;
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  rotationDeg: number;
};

export const AI_RULES = {
  minItemGapMm: 200,
  wallClearanceMm: 150,
  openingClearanceMm: 600,
  circulationWidthMm: 800,
  footprintInsetMm: 250,
  gridStepMm: 200,
  maxPlacementTries: 80,
} as const;

export function getLevelBounds(state: RoomState, levelId: string): AiBoundsMm {
  const walls = state.walls.filter((w) => w.levelId === levelId);
  const fp = computeFootprintFromWalls(walls);
  const inset = AI_RULES.footprintInsetMm;
  if (fp.widthMm > 0 && fp.depthMm > 0) {
    return {
      minX: fp.minX + inset,
      maxX: fp.maxX - inset,
      minZ: fp.minZ + inset,
      maxZ: fp.maxZ - inset,
    };
  }
  const w = state.footprint?.widthMm ?? 4000;
  const d = state.footprint?.depthMm ?? 4000;
  return {
    minX: -w / 2 + inset,
    maxX: w / 2 - inset,
    minZ: -d / 2 + inset,
    maxZ: d / 2 - inset,
  };
}

export function getItemHalfExtents(item: CatalogItemState): { halfW: number; halfD: number } {
  const preset = getCatalogPreset(item.catalogId);
  const w = (preset?.sizeMm.width ?? 600) * (item.scale?.x ?? 1);
  const d = (preset?.sizeMm.depth ?? 600) * (item.scale?.z ?? 1);
  const rot = ((item.rotationDeg % 180) + 180) % 180;
  if (rot > 45 && rot < 135) {
    return { halfW: d / 2, halfD: w / 2 };
  }
  return { halfW: w / 2, halfD: d / 2 };
}

export function toFootprint(item: CatalogItemState): AiItemFootprint {
  const { halfW, halfD } = getItemHalfExtents(item);
  return {
    id: item.id,
    type: item.type,
    cx: item.positionMm.x,
    cz: item.positionMm.z,
    halfW,
    halfD,
    rotationDeg: item.rotationDeg,
  };
}

export function boxesOverlap(
  a: AiItemFootprint,
  b: AiItemFootprint,
  gap = AI_RULES.minItemGapMm
): boolean {
  return (
    Math.abs(a.cx - b.cx) < a.halfW + b.halfW + gap &&
    Math.abs(a.cz - b.cz) < a.halfD + b.halfD + gap
  );
}

export function insideBounds(fp: AiItemFootprint, bounds: AiBoundsMm): boolean {
  return (
    fp.cx - fp.halfW >= bounds.minX &&
    fp.cx + fp.halfW <= bounds.maxX &&
    fp.cz - fp.halfD >= bounds.minZ &&
    fp.cz + fp.halfD <= bounds.maxZ
  );
}

export function openingBlockedZones(
  state: RoomState,
  levelId: string
): Array<{ cx: number; cz: number; radius: number }> {
  const walls = state.walls.filter((w) => w.levelId === levelId);
  const wallById = new Map(walls.map((w) => [w.id, w]));
  const zones: Array<{ cx: number; cz: number; radius: number }> = [];
  for (const o of state.openings) {
    const wall = wallById.get(o.wallId);
    if (!wall) continue;
    const len = wallLengthMm(wall);
    const t = Math.min(1, Math.max(0, (o.offsetAlongWallMm + o.widthMm / 2) / Math.max(1, len)));
    const x = wall.startMm.x + (wall.endMm.x - wall.startMm.x) * t;
    const z = wall.startMm.z + (wall.endMm.z - wall.startMm.z) * t;
    zones.push({
      cx: x,
      cz: z,
      radius: AI_RULES.openingClearanceMm + o.widthMm / 2,
    });
  }
  return zones;
}

export function hitsOpeningZone(
  fp: AiItemFootprint,
  zones: Array<{ cx: number; cz: number; radius: number }>
): boolean {
  for (const z of zones) {
    const dx = fp.cx - z.cx;
    const dz = fp.cz - z.cz;
    if (Math.hypot(dx, dz) < z.radius + Math.max(fp.halfW, fp.halfD) * 0.5) return true;
  }
  return false;
}

export function longestWall(state: RoomState, levelId: string): RoomWall | null {
  const walls = state.walls.filter((w) => w.levelId === levelId);
  if (!walls.length) return null;
  return walls.reduce((best, w) => (wallLengthMm(w) > wallLengthMm(best) ? w : best), walls[0]!);
}

export function wallInwardNormal(wall: RoomWall, bounds: AiBoundsMm): Vec2Mm {
  const dx = wall.endMm.x - wall.startMm.x;
  const dz = wall.endMm.z - wall.startMm.z;
  const len = Math.hypot(dx, dz) || 1;
  let nx = -dz / len;
  let nz = dx / len;
  const mid = {
    x: (wall.startMm.x + wall.endMm.x) / 2,
    z: (wall.startMm.z + wall.endMm.z) / 2,
  };
  const center = {
    x: (bounds.minX + bounds.maxX) / 2,
    z: (bounds.minZ + bounds.maxZ) / 2,
  };
  if ((center.x - mid.x) * nx + (center.z - mid.z) * nz < 0) {
    nx = -nx;
    nz = -nz;
  }
  return { x: nx, z: nz };
}

export function wallYawDeg(wall: RoomWall): number {
  const dx = wall.endMm.x - wall.startMm.x;
  const dz = wall.endMm.z - wall.startMm.z;
  return (Math.atan2(dx, dz) * 180) / Math.PI;
}

export function clampToBounds(
  x: number,
  z: number,
  halfW: number,
  halfD: number,
  bounds: AiBoundsMm
): { x: number; z: number } {
  return {
    x: Math.min(bounds.maxX - halfW, Math.max(bounds.minX + halfW, x)),
    z: Math.min(bounds.maxZ - halfD, Math.max(bounds.minZ + halfD, z)),
  };
}

export function isValidPlacement(
  candidate: AiItemFootprint,
  placed: AiItemFootprint[],
  bounds: AiBoundsMm,
  openingZones: Array<{ cx: number; cz: number; radius: number }>
): boolean {
  if (!insideBounds(candidate, bounds)) return false;
  if (hitsOpeningZone(candidate, openingZones)) return false;
  for (const p of placed) {
    if (boxesOverlap(candidate, p)) return false;
  }
  return true;
}

export function typePriority(type: string): number {
  switch (type) {
    case "sofa":
      return 0;
    case "table":
      return 1;
    case "chair":
      return 2;
    case "lamp":
      return 3;
    default:
      return 4;
  }
}
