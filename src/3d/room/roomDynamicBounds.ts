/**
 * Bounds dinâmicos da sala — AABB de todas as paredes (principais + extras).
 * Sistema centrado; metros no viewer, mm no projeto/wallStore.
 */
import * as THREE from "three";
import type { ProjectRoomConfig, ProjectRoomWall } from "../viewer-engine/room/roomEngineTypes";
import type { Wall } from "../../stores/wallStore";
import type { Room } from "./Room";
import type { RoomBounds } from "./RoomManager";
import type { FloorBoundsMm } from "../../utils/roomWorkspaceBounds";

const _box = new THREE.Box3();

type XzFootprint = { minX: number; maxX: number; minZ: number; maxZ: number };

function mergeFootprint(base: XzFootprint, next: XzFootprint): XzFootprint {
  return {
    minX: Math.min(base.minX, next.minX),
    maxX: Math.max(base.maxX, next.maxX),
    minZ: Math.min(base.minZ, next.minZ),
    maxZ: Math.max(base.maxZ, next.maxZ),
  };
}

/** Footprint XZ (mm) de uma parede do projeto a partir de centro, comprimento, espessura e rotação. */
export function projectWallFootprintXZMm(wall: ProjectRoomWall): XzFootprint {
  const lengthMm = Math.max(1, wall.widthMm ?? wall.lengthMm ?? 1);
  const thickMm = Math.max(10, wall.thicknessMm ?? 200);
  const rot = ((wall.rotationDeg ?? 0) * Math.PI) / 180;
  const cx = wall.position?.x ?? 0;
  const cz = wall.position?.z ?? 0;
  const hw = lengthMm / 2;
  const ht = thickMm / 2;
  const localCorners: Array<[number, number]> = [
    [-hw, -ht],
    [hw, -ht],
    [hw, ht],
    [-hw, ht],
  ];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  for (const [lx, lz] of localCorners) {
    const x = cx + lx * cos - lz * sin;
    const z = cz + lx * sin + lz * cos;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return { minX, maxX, minZ, maxZ };
}

/** Footprint XZ (mm) de uma parede do wallStore (posição em cm). */
export function wallStoreWallFootprintXZMm(wall: Wall): XzFootprint {
  const lengthMm = Math.max(10, (wall.lengthCm ?? 0) * 10);
  const thickMm = Math.max(10, (wall.thicknessCm ?? 20) * 10);
  const rot = ((wall.rotation ?? 0) * Math.PI) / 180;
  const cx = (wall.position?.x ?? 0) * 10;
  const cz = (wall.position?.z ?? 0) * 10;
  const hw = lengthMm / 2;
  const ht = thickMm / 2;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [lx, lz] of [
    [-hw, -ht],
    [hw, -ht],
    [hw, ht],
    [-hw, ht],
  ] as Array<[number, number]>) {
    const x = cx + lx * cos - lz * sin;
    const z = cz + lx * sin + lz * cos;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return { minX, maxX, minZ, maxZ };
}

function meshFootprintXZM(mesh: THREE.Mesh): XzFootprint | null {
  mesh.updateMatrixWorld(true);
  _box.setFromObject(mesh);
  if (_box.isEmpty()) return null;
  return { minX: _box.min.x, maxX: _box.max.x, minZ: _box.min.z, maxZ: _box.max.z };
}

/**
 * AABB da sala em metros (viewer), união do footprint nominal + todas as meshes de parede.
 */
export function computeDynamicRoomBounds(room: Room, walls: THREE.Mesh[]): RoomBounds {
  let minX = room.minX;
  let maxX = room.maxX;
  let minZ = room.minZ;
  let maxZ = room.maxZ;
  let minY = room.minY;
  let maxY = room.maxY;

  for (const wall of walls) {
    const fp = meshFootprintXZM(wall);
    if (!fp) continue;
    minX = Math.min(minX, fp.minX);
    maxX = Math.max(maxX, fp.maxX);
    minZ = Math.min(minZ, fp.minZ);
    maxZ = Math.max(maxZ, fp.maxZ);
    wall.updateMatrixWorld(true);
    _box.setFromObject(wall);
    if (!_box.isEmpty()) {
      minY = Math.min(minY, _box.min.y);
      maxY = Math.max(maxY, _box.max.y);
    }
  }

  return {
    minX,
    maxX,
    minZ,
    maxZ,
    minY,
    maxY,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
  };
}

/** Bounds da sala em mm a partir de ProjectRoomConfig (inclui paredes extras). */
export function computeProjectRoomBoundsMm(room: ProjectRoomConfig): FloorBoundsMm {
  const widthMm = room.widthMm;
  const depthMm = room.depthMm;
  const heightMm = room.heightMm;
  let footprint: XzFootprint = {
    minX: -widthMm / 2,
    maxX: widthMm / 2,
    minZ: -depthMm / 2,
    maxZ: depthMm / 2,
  };
  for (const wall of room.walls) {
    footprint = mergeFootprint(footprint, projectWallFootprintXZMm(wall));
  }
  return {
    minX_mm: footprint.minX,
    maxX_mm: footprint.maxX,
    minZ_mm: footprint.minZ,
    maxZ_mm: footprint.maxZ,
    minY_mm: 0,
    maxY_mm: heightMm,
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
