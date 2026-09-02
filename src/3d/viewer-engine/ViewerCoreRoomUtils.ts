/**
 * STUB no-op — sistema Sala removido (feature/sala-rebuild-opensource).
 * Mantém a superfície importada pelo ViewerCore / ViewerCore*Ops.
 */
import * as THREE from "three";
import type { AutoLayoutOpeningMm, AutoLayoutRoomBoundsMm } from "./autoLayout/autoLayoutTypes";
import type { RoomOpeningLike } from "./snapping/smartSnappingTypes";
import type { RoomBuilder } from "../room/RoomBuilder";
import type { ViewerBoundsCache } from "./cache/ViewerBoundsCache";

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
  _deps: ViewerCoreRoomUtilsDeps
): AutoLayoutRoomBoundsMm | null {
  void _deps;
  return null;
}

export function getRoomOpeningsForSnappingImpl(_deps: ViewerCoreRoomUtilsDeps): RoomOpeningLike[] {
  void _deps;
  return [];
}

export function getRoomOpeningsMmForAutoLayoutImpl(_deps: ViewerCoreRoomUtilsDeps): AutoLayoutOpeningMm[] {
  void _deps;
  return [];
}

export function applyRoomConstraintImpl(
  _deps: ViewerCoreRoomUtilsDeps,
  _movingMesh: THREE.Object3D,
  _options: { ignoreY?: boolean } = {}
): void {
  void _deps;
  void _movingMesh;
  void _options;
}

export function isMeshInsideOrTouchingRoomImpl(
  _deps: ViewerCoreRoomUtilsDeps,
  _movingMesh: THREE.Object3D,
  _tolerance = 0.02
): boolean {
  void _deps;
  void _movingMesh;
  void _tolerance;
  return false;
}
