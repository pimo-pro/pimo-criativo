/**
 * STUB no-op — sistema Sala removido (feature/sala-rebuild-opensource).
 * Mantém a superfície importada pelo ViewerCore / ViewerCore*Ops.
 */
import * as THREE from "three";
import type { DoorWindowConfig } from "../room/types";
import type { RoomManager, RoomBounds } from "../room/RoomManager";
import type { RoomBuilder } from "../room/RoomBuilder";
import type { WallGizmo } from "../gizmos/WallGizmo";
import type { ProjectRoomUtility, RoomFloorMode } from "./room/roomEngineTypes";
import type { SceneManager } from "./scene/SceneManager";
import type { MaterialPipelineFacade } from "./materials/materialPipelineFacade";
import type { ViewerBoundsCache } from "./cache/ViewerBoundsCache";
import type { ViewerState } from "./state/ViewerState";
import type { ViewerBackgroundMode } from "../../context/projectTypes";

export type ViewerCoreRoomWallEntry = {
  id: number;
  normal: THREE.Vector3;
  mesh: THREE.Mesh;
};

export type ViewerCoreRoomGeometryDeps = {
  getRoomBoxGroup: () => THREE.Group | null;
  setRoomBoxGroup: (group: THREE.Group | null) => void;
  getRoomBoxWalls: () => ViewerCoreRoomWallEntry[];
  setRoomBoxWalls: (walls: ViewerCoreRoomWallEntry[]) => void;
  getRoomBoxFloor: () => THREE.Mesh | null;
  setRoomBoxFloor: (floor: THREE.Mesh | null) => void;
  getRoomBoxFloorOutline: () => THREE.LineLoop | null;
  setRoomBoxFloorOutline: (outline: THREE.LineLoop | null) => void;
  getRoomBoxCeiling: () => THREE.Mesh | null;
  setRoomBoxCeiling: (ceiling: THREE.Mesh | null) => void;
  getRoomFloorRoot: () => THREE.Group | null;
  setRoomFloorRoot: (root: THREE.Group | null) => void;
  getRoomUtilitiesRoot: () => THREE.Group | null;
  setRoomUtilitiesRoot: (root: THREE.Group | null) => void;
  getRoomBounds: () => RoomBounds | null;
  setRoomBounds: (bounds: RoomBounds | null) => void;
  getRoomCeilingVisible: () => boolean;
  setRoomCeilingVisibleFlag: (visible: boolean) => void;
  getRoomFloorMode: () => RoomFloorMode;
  setRoomFloorModeState: (mode: RoomFloorMode) => void;
  getHiddenRoomWallIds: () => Set<number>;
  setHiddenRoomWallIds: (ids: Set<number>) => void;
  getManualHiddenWallId: () => number | null;
  setManualHiddenWallId: (id: number | null) => void;
  sceneManager: SceneManager;
  materialPipeline: MaterialPipelineFacade;
  boundsCache: ViewerBoundsCache;
  roomBuilder: RoomBuilder;
  wallGizmo: WallGizmo | null;
  viewerState: ViewerState;
  getRoomManager: () => RoomManager | null;
  defaultGroundSize: number;
  getBackgroundMode: () => ViewerBackgroundMode;
  disposeObject: (object: THREE.Object3D) => void;
  applyBackgroundMode: () => void;
  refreshTransformControlsAttachment: () => void;
  refreshOutlineTarget: () => void;
  getWallIdInFrontOfCamera: () => number | null;
  getCamera: () => THREE.Camera;
  onWallTransform: ((wallIndex: number, position: { x: number; z: number }, rotation: number) => void) | null;
  onRoomElementTransform: ((elementId: string, config: DoorWindowConfig) => void) | null;
  onRoomUtilityTransform: ((
    utilityId: string,
    patch: Pick<ProjectRoomUtility, "positionAlongWall" | "heightMm">
  ) => void) | null;
};

export function setRoomCeilingVisibleImpl(_deps: ViewerCoreRoomGeometryDeps, _visible: boolean): void {
  void _deps;
  void _visible;
}
export function setRoomFloorModeImpl(_deps: ViewerCoreRoomGeometryDeps, _mode: RoomFloorMode): void {
  void _deps;
  void _mode;
}
export function setRoomHiddenWallsImpl(_deps: ViewerCoreRoomGeometryDeps, _wallIds: string[]): void {
  void _deps;
  void _wallIds;
}
export function setRoomUtilitiesImpl(_deps: ViewerCoreRoomGeometryDeps, _utilities: ProjectRoomUtility[]): void {
  void _deps;
  void _utilities;
}
export function setWallEditModeImpl(_deps: ViewerCoreRoomGeometryDeps, _enabled: boolean): void {
  void _deps;
  void _enabled;
}
export function setManualWallHiddenImpl(_deps: ViewerCoreRoomGeometryDeps, _active: boolean): void {
  void _deps;
  void _active;
}
export function getManualWallHiddenImpl(_deps: ViewerCoreRoomGeometryDeps): boolean {
  void _deps;
  return false;
}
export function clearRoomBoxImpl(_deps: ViewerCoreRoomGeometryDeps): void {
  void _deps;
}
export function ensureStaticSceneGroundImpl(_deps: ViewerCoreRoomGeometryDeps): void {
  void _deps;
}
export function setRoomFromManagerImpl(
  _deps: ViewerCoreRoomGeometryDeps,
  _walls: ViewerCoreRoomWallEntry[],
  _bounds: RoomBounds,
  _group: THREE.Group
): void {
  void _deps;
  void _walls;
  void _bounds;
  void _group;
}
export function clearRoomFromManagerImpl(_deps: ViewerCoreRoomGeometryDeps): void {
  void _deps;
}
export function rebuildRoomFloorAndCeilingImpl(_deps: ViewerCoreRoomGeometryDeps): void {
  void _deps;
}
export function getRoomUtilityByIdImpl(
  _deps: ViewerCoreRoomGeometryDeps,
  _utilityId: string
): THREE.Object3D | null {
  void _deps;
  void _utilityId;
  return null;
}
export function setRoomBoundsImpl(
  _deps: ViewerCoreRoomGeometryDeps,
  _bounds: {
    width: number;
    depth: number;
    height: number;
    originX?: number;
    originZ?: number;
  }
): void {
  void _deps;
  void _bounds;
}
export function clearRoomBoundsImpl(_deps: ViewerCoreRoomGeometryDeps): void {
  void _deps;
}
export function applyRoomWallVisibilityImpl(_deps: ViewerCoreRoomGeometryDeps): void {
  void _deps;
}
export function updateWallVisibilityBasedOnCameraImpl(_deps: ViewerCoreRoomGeometryDeps): void {
  void _deps;
}
export function notifyWallTransformImpl(_deps: ViewerCoreRoomGeometryDeps): void {
  void _deps;
}
export function notifyRoomElementTransformImpl(_deps: ViewerCoreRoomGeometryDeps): void {
  void _deps;
}
export function notifyRoomUtilityTransformImpl(_deps: ViewerCoreRoomGeometryDeps): void {
  void _deps;
}
