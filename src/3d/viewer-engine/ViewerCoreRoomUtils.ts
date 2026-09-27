/**
 * ViewerCoreRoomUtils — superfície de sala para snap / auto-layout / constraints.
 * Implementação restaurada via pimo-room-v4/adapters/viewerSurfaceAdapter (Fase A).
 */
import * as THREE from "three";
import type { AutoLayoutOpeningMm, AutoLayoutRoomBoundsMm } from "./autoLayout/autoLayoutTypes";
import type { RoomOpeningLike } from "./snapping/smartSnappingTypes";
import type { RoomBuilder } from "../room/RoomBuilder";
import type { ViewerBoundsCache } from "./cache/ViewerBoundsCache";
import {
  applyRoomConstraintFromDeps,
  getRoomBoundsMmFromDeps,
  getRoomOpeningsForSnappingFromDeps,
  getRoomOpeningsMmForAutoLayoutFromDeps,
  isMeshInsideOrTouchingRoomFromDeps,
} from "../../pimo-room-v4/adapters/viewerSurfaceAdapter";

export type ViewerCoreRoomBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
  centerX: number;
  centerZ: number;
};

export type ViewerCoreRoomUtilsDeps = {
  getRoomBounds: () => ViewerCoreRoomBounds | null;
  lockEnabled: boolean;
  wallInnerInsetM: number;
  snapWallOffsetM: number;
  boundingBox: THREE.Box3;
  boundsCache: ViewerBoundsCache;
  roomBuilder: RoomBuilder;
};

export function getRoomBoundsMmForAutoLayoutImpl(
  deps: ViewerCoreRoomUtilsDeps
): AutoLayoutRoomBoundsMm | null {
  return getRoomBoundsMmFromDeps(deps);
}

export function getRoomOpeningsForSnappingImpl(deps: ViewerCoreRoomUtilsDeps): RoomOpeningLike[] {
  return getRoomOpeningsForSnappingFromDeps(deps);
}

export function getRoomOpeningsMmForAutoLayoutImpl(
  deps: ViewerCoreRoomUtilsDeps
): AutoLayoutOpeningMm[] {
  return getRoomOpeningsMmForAutoLayoutFromDeps(deps);
}

export function applyRoomConstraintImpl(
  deps: ViewerCoreRoomUtilsDeps,
  movingMesh: THREE.Object3D,
  options: { ignoreY?: boolean } = {}
): void {
  applyRoomConstraintFromDeps(deps, movingMesh, options);
}

export function isMeshInsideOrTouchingRoomImpl(
  deps: ViewerCoreRoomUtilsDeps,
  movingMesh: THREE.Object3D,
  tolerance = 0.02
): boolean {
  return isMeshInsideOrTouchingRoomFromDeps(deps, movingMesh, tolerance);
}
