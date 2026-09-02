/**
 * STUB — geometria de bounds mínima para autoRoomFill (fora do âmbito de remoção).
 * Sistema Sala 3D removido (feature/sala-rebuild-opensource).
 */
import type { ProjectRoomConfig, ProjectRoomWall } from "../viewer-engine/room/roomEngineTypes";
import type { Wall } from "../../stores/wallStore";
import type { FloorBoundsMm } from "../../utils/roomWorkspaceBounds";

type XzFootprint = { minX: number; maxX: number; minZ: number; maxZ: number };

export function projectWallFootprintXZMm(wall: ProjectRoomWall): XzFootprint {
  const halfL = Math.max(0, wall.widthMm || wall.lengthMm || 0) / 2;
  const halfT = Math.max(0, wall.thicknessMm || 0) / 2;
  const x = wall.position?.x ?? 0;
  const z = wall.position?.z ?? 0;
  const rot = ((wall.rotationDeg ?? 0) * Math.PI) / 180;
  const c = Math.abs(Math.cos(rot));
  const s = Math.abs(Math.sin(rot));
  const hx = halfL * c + halfT * s;
  const hz = halfL * s + halfT * c;
  return { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz };
}

export function wallStoreWallFootprintXZMm(wall: Wall): XzFootprint {
  const lengthMm = (wall.lengthCm ?? 0) * 10;
  const thicknessMm = (wall.thicknessCm ?? 0) * 10;
  const halfL = lengthMm / 2;
  const halfT = thicknessMm / 2;
  const x = (wall.position?.x ?? 0) * 10;
  const z = (wall.position?.z ?? 0) * 10;
  const rot = ((wall.rotation ?? 0) * Math.PI) / 180;
  const c = Math.abs(Math.cos(rot));
  const s = Math.abs(Math.sin(rot));
  const hx = halfL * c + halfT * s;
  const hz = halfL * s + halfT * c;
  return { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz };
}

export function computeProjectRoomBoundsMm(room: ProjectRoomConfig): FloorBoundsMm {
  const halfW = Math.max(0, room.widthMm) / 2;
  const halfD = Math.max(0, room.depthMm) / 2;
  let minX_mm = -halfW;
  let maxX_mm = halfW;
  let minZ_mm = -halfD;
  let maxZ_mm = halfD;
  for (const wall of room.walls ?? []) {
    const fp = projectWallFootprintXZMm(wall);
    minX_mm = Math.min(minX_mm, fp.minX);
    maxX_mm = Math.max(maxX_mm, fp.maxX);
    minZ_mm = Math.min(minZ_mm, fp.minZ);
    maxZ_mm = Math.max(maxZ_mm, fp.maxZ);
  }
  return {
    minX_mm,
    maxX_mm,
    minZ_mm,
    maxZ_mm,
    minY_mm: 0,
    maxY_mm: Math.max(0, room.heightMm),
  };
}

export function getEffectiveRoomSpanMm(room: ProjectRoomConfig): {
  widthMm: number;
  depthMm: number;
  minX_mm: number;
  maxX_mm: number;
  minZ_mm: number;
  maxZ_mm: number;
} {
  const bounds = computeProjectRoomBoundsMm(room);
  return {
    widthMm: bounds.maxX_mm - bounds.minX_mm,
    depthMm: bounds.maxZ_mm - bounds.minZ_mm,
    minX_mm: bounds.minX_mm,
    maxX_mm: bounds.maxX_mm,
    minZ_mm: bounds.minZ_mm,
    maxZ_mm: bounds.maxZ_mm,
  };
}
