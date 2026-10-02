/**
 * Adapter ViewerCore ↔ room surface (snap / auto-layout).
 * Restaura a lógica removida nos stubs de ViewerCoreRoomUtils.
 * Tipos locais evitam ciclo viewer-engine ↔ room-engine.
 */
import * as THREE from "three";
import { isMeshInsideOrTouchingRoomBounds } from "../../viewer/core/viewerUtils";
import { setBox3FromObjectExcludingLayoutProxy } from "../../3d/viewer-engine/box/boxAabbUtils";
import type { AutoLayoutOpeningMm, AutoLayoutRoomBoundsMm } from "../../3d/viewer-engine/autoLayout/autoLayoutTypes";
import type { RoomOpeningLike } from "../../3d/viewer-engine/snapping/smartSnappingTypes";
import type { RoomBuilder } from "../mesh/impl/RoomBuilder";
import type { ViewerBoundsCache } from "../../3d/viewer-engine/cache/ViewerBoundsCache";
import { mToMm } from "../../utils/units";

export type RoomSurfaceBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
  centerX: number;
  centerZ: number;
};

export type RoomSurfaceDeps = {
  getRoomBounds: () => RoomSurfaceBounds | null;
  lockEnabled: boolean;
  wallInnerInsetM: number;
  snapWallOffsetM: number;
  boundingBox: THREE.Box3;
  boundsCache: ViewerBoundsCache;
  roomBuilder: RoomBuilder;
};

export function getRoomBoundsMmFromDeps(deps: RoomSurfaceDeps): AutoLayoutRoomBoundsMm | null {
  const b = deps.getRoomBounds();
  if (!b) return null;
  return {
    minX_mm: mToMm(b.minX),
    maxX_mm: mToMm(b.maxX),
    minZ_mm: mToMm(b.minZ),
    maxZ_mm: mToMm(b.maxZ),
    minY_mm: mToMm(b.minY),
    maxY_mm: mToMm(b.maxY),
  };
}

export function getRoomOpeningsForSnappingFromDeps(deps: RoomSurfaceDeps): RoomOpeningLike[] {
  const gen = deps.boundsCache.getRoomGeneration();
  return deps.boundsCache.getRoomOpenings(gen, () => {
    const out: RoomOpeningLike[] = [];
    const box = deps.boundingBox;
    for (const el of deps.roomBuilder.getElements()) {
      const group = deps.roomBuilder.getElementById(el.elementId);
      if (!group) continue;
      group.updateMatrixWorld(true);
      box.setFromObject(group);
      if (box.isEmpty()) continue;
      out.push({
        elementId: el.elementId,
        type: el.type,
        min: box.min.clone(),
        max: box.max.clone(),
      });
    }
    return out;
  });
}

export function getRoomOpeningsMmForAutoLayoutFromDeps(
  deps: RoomSurfaceDeps
): AutoLayoutOpeningMm[] {
  return getRoomOpeningsForSnappingFromDeps(deps).map((opening) => ({
    minX_mm: mToMm(opening.min.x),
    maxX_mm: mToMm(opening.max.x),
    minZ_mm: mToMm(opening.min.z),
    maxZ_mm: mToMm(opening.max.z),
  }));
}

/**
 * Restringe a caixa aos limites da sala.
 * Com lock ON: inset interno para não entrar no muro.
 */
export function applyRoomConstraintFromDeps(
  deps: RoomSurfaceDeps,
  movingMesh: THREE.Object3D,
  options: { ignoreY?: boolean } = {}
): void {
  const roomBounds = deps.getRoomBounds();
  if (!roomBounds) return;
  movingMesh.updateMatrixWorld(true);
  const movingBox = new THREE.Box3();
  setBox3FromObjectExcludingLayoutProxy(movingBox, movingMesh);
  const inset = deps.lockEnabled ? deps.wallInnerInsetM : 0;
  const off = deps.lockEnabled ? deps.snapWallOffsetM : 0;
  const minX = roomBounds.minX + inset + off;
  const maxX = roomBounds.maxX - inset - off;
  const minZ = roomBounds.minZ + inset + off;
  const maxZ = roomBounds.maxZ - inset - off;
  const minY = roomBounds.minY;
  const maxY = roomBounds.maxY;
  let dx = 0;
  let dy = 0;
  let dz = 0;
  if (movingBox.min.x < minX) dx += minX - movingBox.min.x;
  if (movingBox.max.x > maxX) dx -= movingBox.max.x - maxX;
  if (movingBox.min.z < minZ) dz += minZ - movingBox.min.z;
  if (movingBox.max.z > maxZ) dz -= movingBox.max.z - maxZ;
  if (!options.ignoreY) {
    if (movingBox.min.y < minY) dy += minY - movingBox.min.y;
    if (movingBox.max.y > maxY) dy -= movingBox.max.y - maxY;
  }
  if (dx !== 0 || dy !== 0 || dz !== 0) {
    movingMesh.position.x += dx;
    movingMesh.position.y += dy;
    movingMesh.position.z += dz;
  }
}

export function isMeshInsideOrTouchingRoomFromDeps(
  deps: RoomSurfaceDeps,
  movingMesh: THREE.Object3D,
  tolerance = 0.02
): boolean {
  const roomBounds = deps.getRoomBounds();
  if (!roomBounds) return false;
  return isMeshInsideOrTouchingRoomBounds(movingMesh, roomBounds, tolerance, deps.boundingBox);
}
