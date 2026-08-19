import * as THREE from "three";
import type { ViewerBackgroundMode } from "../../context/projectTypes";
import { snapHorizontalOffset } from "../../utils/openingConstraints";
import type { DoorWindowConfig } from "../room/types";
import type { RoomManager, RoomBounds, WallEntryForViewer } from "../room/RoomManager";
import type { RoomBuilder } from "../room/RoomBuilder";
import { updateWallCulling } from "../visibility/WallRaycastCulling";
import type { MaterialPipelineFacade } from "./materials/materialPipelineFacade";
import type { ViewerBoundsCache } from "./cache/ViewerBoundsCache";
import type { SceneManager } from "./scene/SceneManager";
import type { ViewerState } from "./state/ViewerState";
import type { WallGizmo } from "../gizmos/WallGizmo";
import type { ProjectRoomUtility, RoomFloorMode } from "./room/roomEngineTypes";
import {
  createRoomFloorOutline,
  createRoomFloorOverlayMaterial,
  getRoomFloorExpandM,
  getRoomFloorOverlayAppearance,
} from "./materials/roomFloorOverlay";

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

function utilityColor(type: ProjectRoomUtility["type"]): number {
  if (type === "WaterPoint") return 0x38bdf8;
  if (type === "DrainPoint") return 0x64748b;
  return 0xfacc15;
}

export function setRoomCeilingVisibleImpl(deps: ViewerCoreRoomGeometryDeps, visible: boolean): void {
  deps.setRoomCeilingVisibleFlag(Boolean(visible));
  const roomBoxCeiling = deps.getRoomBoxCeiling();
  if (roomBoxCeiling) {
    roomBoxCeiling.visible = deps.getRoomCeilingVisible();
  }
  const roomBoxGroup = deps.getRoomBoxGroup();
  if (roomBoxGroup) {
    roomBoxGroup.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (node.userData?.isRoomCeiling === true) {
        node.visible = deps.getRoomCeilingVisible();
      }
    });
  }
}

export function setRoomFloorModeImpl(deps: ViewerCoreRoomGeometryDeps, mode: RoomFloorMode): void {
  deps.setRoomFloorModeState(mode === "full" || mode === "hybrid" || mode === "room" ? mode : "room");
  rebuildRoomFloorAndCeilingImpl(deps);
}

export function setRoomHiddenWallsImpl(deps: ViewerCoreRoomGeometryDeps, wallIds: string[]): void {
  const byStringId = new Map(
    deps.getRoomBoxWalls().map((entry) => [
      String(entry.mesh.userData.wallProjectId ?? entry.mesh.userData.wallId ?? entry.id),
      entry.id,
    ])
  );
  deps.setHiddenRoomWallIds(
    new Set(
      (Array.isArray(wallIds) ? wallIds : [])
        .map((id) => byStringId.get(id))
        .filter((id): id is number => typeof id === "number")
    )
  );
  applyRoomWallVisibilityImpl(deps);
}

export function setRoomUtilitiesImpl(deps: ViewerCoreRoomGeometryDeps, utilities: ProjectRoomUtility[]): void {
  rebuildRoomUtilitiesImpl(deps, Array.isArray(utilities) ? utilities : []);
}

export function setWallEditModeImpl(deps: ViewerCoreRoomGeometryDeps, enabled: boolean): void {
  deps.viewerState.setWallEditMode(Boolean(enabled));
  const wallGizmo = deps.wallGizmo;
  if (!wallGizmo) return;
  wallGizmo.group.visible = deps.viewerState.getWallEditMode();
  if (!deps.viewerState.getWallEditMode()) {
    wallGizmo.detach();
    return;
  }
  if (deps.viewerState.getSelectedWallIndex() !== null) {
    const wall = deps
      .getRoomBoxWalls()
      .find((w) => w.id === deps.viewerState.getSelectedWallIndex())?.mesh;
    if (wall) wallGizmo.attach(wall);
  }
}

export function setManualWallHiddenImpl(deps: ViewerCoreRoomGeometryDeps, active: boolean): void {
  if (!active) {
    deps.setManualHiddenWallId(null);
    deps.getRoomBoxWalls().forEach((w) => {
      w.mesh.visible = true;
    });
    return;
  }
  const wallId = deps.viewerState.getSelectedWallIndex() ?? deps.getWallIdInFrontOfCamera();
  if (wallId === null) return;
  deps.setManualHiddenWallId(wallId);
  deps.getRoomBoxWalls().forEach((w) => {
    if (w.id === wallId) w.mesh.visible = false;
  });
}

export function getManualWallHiddenImpl(deps: ViewerCoreRoomGeometryDeps): boolean {
  return deps.getManualHiddenWallId() !== null;
}

export function clearRoomBoxImpl(deps: ViewerCoreRoomGeometryDeps): void {
  const roomBoxGroup = deps.getRoomBoxGroup();
  if (roomBoxGroup) {
    deps.sceneManager.root.remove(roomBoxGroup);
  }
  deps.getRoomBoxWalls().forEach((w) => {
    w.mesh.geometry.dispose();
    if (Array.isArray(w.mesh.material)) {
      w.mesh.material.forEach((m) => m.dispose());
    } else {
      w.mesh.material.dispose();
    }
  });
  const roomBoxFloor = deps.getRoomBoxFloor();
  if (roomBoxFloor) {
    roomBoxFloor.geometry.dispose();
    if (Array.isArray(roomBoxFloor.material)) {
      roomBoxFloor.material.forEach((m) => m.dispose());
    } else {
      roomBoxFloor.material.dispose();
    }
  }
  const roomBoxCeiling = deps.getRoomBoxCeiling();
  if (roomBoxCeiling) {
    roomBoxCeiling.geometry.dispose();
    if (Array.isArray(roomBoxCeiling.material)) {
      roomBoxCeiling.material.forEach((m) => m.dispose());
    } else {
      roomBoxCeiling.material.dispose();
    }
  }
  const roomFloorRoot = deps.getRoomFloorRoot();
  if (roomFloorRoot) {
    deps.disposeObject(roomFloorRoot);
    roomFloorRoot.removeFromParent();
  }
  const roomUtilitiesRoot = deps.getRoomUtilitiesRoot();
  if (roomUtilitiesRoot) {
    deps.disposeObject(roomUtilitiesRoot);
    roomUtilitiesRoot.removeFromParent();
  }
  deps.setRoomBoxGroup(null);
  deps.setRoomBoxWalls([]);
  deps.setRoomBoxFloor(null);
  deps.setRoomBoxFloorOutline(null);
  deps.setRoomBoxCeiling(null);
  deps.setRoomFloorRoot(null);
  deps.setRoomUtilitiesRoot(null);
}

export function ensureStaticSceneGroundImpl(deps: ViewerCoreRoomGeometryDeps): void {
  deps.sceneManager.setGroundSize(deps.defaultGroundSize, deps.defaultGroundSize);
  deps.sceneManager.setGroundPosition(0, 0);
}

export function setRoomFromManagerImpl(
  deps: ViewerCoreRoomGeometryDeps,
  walls: WallEntryForViewer[],
  bounds: RoomBounds,
  group: THREE.Group
): void {
  const roomBoxGroup = deps.getRoomBoxGroup();
  if (roomBoxGroup && roomBoxGroup !== group) {
    deps.sceneManager.root.remove(roomBoxGroup);
  }
  deps.setRoomBoxGroup(group);
  deps.setRoomBoxWalls(walls);
  deps.setRoomBoxFloor(null);
  deps.setRoomBoxFloorOutline(null);
  deps.setRoomBoxCeiling(null);
  deps.setRoomBounds(bounds);
  deps.boundsCache.invalidateRoom();
  deps.sceneManager.root.add(group);
  ensureStaticSceneGroundImpl(deps);
  rebuildRoomFloorAndCeilingImpl(deps);
  applyRoomWallVisibilityImpl(deps);
  setRoomCeilingVisibleImpl(deps, deps.getRoomCeilingVisible());
}

export function clearRoomFromManagerImpl(deps: ViewerCoreRoomGeometryDeps): void {
  deps.roomBuilder.clearRoom(true);
  const roomBoxGroup = deps.getRoomBoxGroup();
  if (roomBoxGroup) {
    deps.sceneManager.root.remove(roomBoxGroup);
  }
  deps.setRoomBoxWalls([]);
  deps.setRoomBoxGroup(null);
  deps.setRoomBoxFloor(null);
  deps.setRoomBoxFloorOutline(null);
  deps.setRoomBoxCeiling(null);
  deps.setRoomFloorRoot(null);
  deps.setRoomUtilitiesRoot(null);
  deps.setRoomBounds(null);
  deps.boundsCache.invalidateRoom();
  deps.viewerState.setSelectedWallIndex(null);
  deps.wallGizmo?.detach();
  deps.refreshTransformControlsAttachment();
  deps.refreshOutlineTarget();
  ensureStaticSceneGroundImpl(deps);
}

function getRoomFloorShape(deps: ViewerCoreRoomGeometryDeps, expandM = 0): THREE.Shape | null {
  const roomBounds = deps.getRoomBounds();
  if (!roomBounds) return null;
  const { minX, maxX, minZ, maxZ } = roomBounds;
  const shape = new THREE.Shape();
  shape.moveTo(minX - expandM, minZ - expandM);
  shape.lineTo(maxX + expandM, minZ - expandM);
  shape.lineTo(maxX + expandM, maxZ + expandM);
  shape.lineTo(minX - expandM, maxZ + expandM);
  shape.lineTo(minX - expandM, minZ - expandM);
  return shape;
}

function clearRoomFloorRootImpl(deps: ViewerCoreRoomGeometryDeps): void {
  const roomFloorRoot = deps.getRoomFloorRoot();
  if (!roomFloorRoot) return;
  deps.disposeObject(roomFloorRoot);
  roomFloorRoot.removeFromParent();
  deps.setRoomFloorRoot(null);
  deps.setRoomBoxFloor(null);
  deps.setRoomBoxFloorOutline(null);
  deps.setRoomBoxCeiling(null);
}

export function rebuildRoomFloorAndCeilingImpl(deps: ViewerCoreRoomGeometryDeps): void {
  const roomBoxGroup = deps.getRoomBoxGroup();
  const roomBounds = deps.getRoomBounds();
  if (!roomBoxGroup || !roomBounds) return;
  clearRoomFloorRootImpl(deps);
  const sceneConfig = deps.materialPipeline.getSceneMaterialConfig();
  const group = new THREE.Group();
  group.name = "room-floor-root";
  const expandM = getRoomFloorExpandM(deps.getRoomFloorMode());
  const shape = getRoomFloorShape(deps, expandM);
  if (!shape) return;
  const floorAppearance = getRoomFloorOverlayAppearance(deps.getBackgroundMode());
  const floorGeom = new THREE.ShapeGeometry(shape);
  floorGeom.rotateX(-Math.PI / 2);
  const floorMat = createRoomFloorOverlayMaterial(floorAppearance);
  const floor = new THREE.Mesh(floorGeom, floorMat);
  floor.position.y = roomBounds.minY + 0.002;
  floor.name = "room-floor-root";
  floor.userData.isRoomFloor = true;
  floor.renderOrder = 1;
  group.add(floor);

  const outline = createRoomFloorOutline(
    roomBounds.minX,
    roomBounds.maxX,
    roomBounds.minZ,
    roomBounds.maxZ,
    expandM,
    roomBounds.minY + 0.004,
    floorAppearance.outlineColor
  );
  group.add(outline);

  const ceilingGeom = new THREE.ShapeGeometry(shape);
  ceilingGeom.rotateX(Math.PI / 2);
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: sceneConfig.roomBox.color,
    roughness: sceneConfig.roomBox.roughness,
    metalness: sceneConfig.roomBox.metalness,
    transparent: true,
    opacity: Math.min(0.45, sceneConfig.roomBox.opacity),
    side: THREE.DoubleSide,
  });
  const ceiling = new THREE.Mesh(ceilingGeom, ceilingMat);
  ceiling.position.y = roomBounds.maxY;
  ceiling.name = "room-ceiling";
  ceiling.userData.isRoomCeiling = true;
  ceiling.visible = deps.getRoomCeilingVisible();
  group.add(ceiling);

  roomBoxGroup.add(group);
  deps.setRoomFloorRoot(group);
  deps.setRoomBoxFloor(floor);
  deps.setRoomBoxFloorOutline(outline);
  deps.setRoomBoxCeiling(ceiling);
  deps.applyBackgroundMode();
}

function clearRoomUtilitiesRootImpl(deps: ViewerCoreRoomGeometryDeps): void {
  deps.getRoomBoxWalls().forEach((entry) => {
    const toRemove = entry.mesh.children.filter((child) => child.userData?.roomUtilityId);
    toRemove.forEach((child) => {
      entry.mesh.remove(child);
      deps.disposeObject(child);
    });
  });
  const roomUtilitiesRoot = deps.getRoomUtilitiesRoot();
  if (!roomUtilitiesRoot) return;
  roomUtilitiesRoot.removeFromParent();
  deps.setRoomUtilitiesRoot(null);
}

function rebuildRoomUtilitiesImpl(deps: ViewerCoreRoomGeometryDeps, utilities: ProjectRoomUtility[]): void {
  clearRoomUtilitiesRootImpl(deps);
  const roomBoxGroup = deps.getRoomBoxGroup();
  if (!roomBoxGroup || !utilities.length) return;
  const root = new THREE.Group();
  root.name = "room-utilities-root";
  const wallsByProjectId = new Map<string, THREE.Mesh>();
  deps.getRoomBoxWalls().forEach((entry) => {
    const key = String(entry.mesh.userData.wallProjectId ?? entry.mesh.userData.wallId ?? entry.id);
    wallsByProjectId.set(key, entry.mesh);
  });
  utilities.forEach((utility) => {
    const wall = wallsByProjectId.get(utility.wallId);
    if (!wall) return;
    const wallLenMm = (wall.userData.wallLengthMm as number | undefined) ?? 1000;
    const wallHeightMm = (wall.userData.wallHeightMm as number | undefined) ?? 2600;
    const wallLenM = wallLenMm / 1000;
    const wallHeightM = wallHeightMm / 1000;
    const t = (wall.userData.wallThicknessM as number | undefined) ?? 0.12;
    const marker = new THREE.Group();
    marker.name = `room-utility-${utility.type}`;
    marker.userData.roomUtilityId = utility.id;
    marker.userData.roomUtility = { ...utility };
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.16, 0.018),
      new THREE.MeshStandardMaterial({ color: utilityColor(utility.type), roughness: 0.55, metalness: 0.05 })
    );
    plate.userData.roomUtilityId = utility.id;
    marker.add(plate);
    const x = -wallLenM / 2 + Math.max(0, Math.min(wallLenMm, utility.positionAlongWall)) / 1000;
    const y = -wallHeightM / 2 + Math.max(0, Math.min(wallHeightMm, utility.heightMm)) / 1000;
    marker.position.set(x, y, t / 2 + 0.04);
    wall.add(marker);
  });
  roomBoxGroup.add(root);
  deps.setRoomUtilitiesRoot(root);
  applyRoomWallVisibilityImpl(deps);
}

export function getRoomUtilityByIdImpl(
  deps: ViewerCoreRoomGeometryDeps,
  utilityId: string
): THREE.Object3D | null {
  for (const wall of deps.getRoomBoxWalls()) {
    const found = wall.mesh.children.find((child) => child.userData?.roomUtilityId === utilityId);
    if (found) return found;
  }
  return null;
}

export function setRoomBoundsImpl(
  deps: ViewerCoreRoomGeometryDeps,
  bounds: {
    width: number;
    depth: number;
    height: number;
    originX?: number;
    originZ?: number;
  }
): void {
  void bounds;
  clearRoomBoundsImpl(deps);
}

export function clearRoomBoundsImpl(deps: ViewerCoreRoomGeometryDeps): void {
  const roomManager = deps.getRoomManager();
  if (roomManager?.room) {
    roomManager.removeRoom();
    return;
  }
  deps.setRoomBounds(null);
  ensureStaticSceneGroundImpl(deps);
  clearRoomBoxImpl(deps);
  deps.roomBuilder.clearRoom(true);
}

export function applyRoomWallVisibilityImpl(deps: ViewerCoreRoomGeometryDeps): void {
  deps.getRoomBoxWalls().forEach((entry) => {
    if (!deps.getHiddenRoomWallIds().has(entry.id)) return;
    entry.mesh.visible = false;
    entry.mesh.children.forEach((child) => {
      if (child.userData?.elementId || child.userData?.roomUtilityId) child.visible = false;
    });
  });

  const manualHiddenWallId = deps.getManualHiddenWallId();
  if (manualHiddenWallId !== null) {
    deps.getRoomBoxWalls().forEach((entry) => {
      if (entry.id === manualHiddenWallId) {
        entry.mesh.visible = false;
      }
    });
  }
}

export function updateWallVisibilityBasedOnCameraImpl(deps: ViewerCoreRoomGeometryDeps): void {
  const roomBounds = deps.getRoomBounds();
  if (!roomBounds) return;
  const wallsMain = deps
    .getRoomBoxWalls()
    .map((w) => w.mesh)
    .filter((m) => m.userData?.isMainWall === true);

  updateWallCulling(deps.getCamera(), roomBounds, wallsMain);
  applyRoomWallVisibilityImpl(deps);
}

export function notifyWallTransformImpl(deps: ViewerCoreRoomGeometryDeps): void {
  const selectedWallIndex = deps.viewerState.getSelectedWallIndex();
  if (selectedWallIndex === null) return;
  const wall = deps.getRoomBoxWalls().find((w) => w.id === selectedWallIndex)?.mesh;
  if (!wall) return;
  const rotationDeg = (wall.rotation.y * 180) / Math.PI;
  const roomManager = deps.getRoomManager();
  if (
    roomManager?.room &&
    roomManager.locked &&
    selectedWallIndex >= 0 &&
    selectedWallIndex <= 3
  ) {
    roomManager.onMainWallTransformed(
      selectedWallIndex,
      { x: wall.position.x, z: wall.position.z },
      rotationDeg
    );
  }
  const wallAfter = deps.getRoomBoxWalls().find((w) => w.id === selectedWallIndex)?.mesh;
  if (wallAfter && deps.onWallTransform) {
    const { x, z } = wallAfter.position;
    const rotDeg = (wallAfter.rotation.y * 180) / Math.PI;
    deps.onWallTransform(selectedWallIndex, { x, z }, rotDeg);
  }
  roomManager?.refreshDynamicBounds();
}

export function notifyRoomElementTransformImpl(deps: ViewerCoreRoomGeometryDeps): void {
  const elementId = deps.viewerState.getSelectedRoomElementId();
  if (!elementId || !deps.onRoomElementTransform) return;
  const element = deps.roomBuilder.getElementById(elementId);
  if (!element || !element.parent) return;
  const wall = element.parent as THREE.Mesh;
  const wallLenMm = (wall.userData.wallLengthMm as number) ?? 4000;
  const wallHeightMm = (wall.userData.wallHeightMm as number) ?? 2800;
  const wallLenM = wallLenMm * 0.001;
  element.updateMatrixWorld(true);
  wall.updateMatrixWorld(true);
  const localPos = new THREE.Vector3();
  element.getWorldPosition(localPos);
  wall.worldToLocal(localPos);
  const cur = element.userData.config as DoorWindowConfig;
  let horizontalOffsetMm = (localPos.x + wallLenM / 2) * 1000 - cur.widthMm / 2;
  let floorOffsetMm = localPos.y * 1000 - cur.heightMm / 2;
  horizontalOffsetMm = Math.max(0, Math.min(wallLenMm - cur.widthMm, horizontalOffsetMm));
  floorOffsetMm = Math.max(0, Math.min(wallHeightMm - cur.heightMm, floorOffsetMm));
  horizontalOffsetMm = snapHorizontalOffset(horizontalOffsetMm, cur.widthMm, wallLenMm, true);
  const config: DoorWindowConfig = {
    ...cur,
    horizontalOffsetMm,
    floorOffsetMm,
  };
  deps.onRoomElementTransform(elementId, config);
}

export function notifyRoomUtilityTransformImpl(deps: ViewerCoreRoomGeometryDeps): void {
  const utilityId = deps.viewerState.getSelectedRoomUtilityId();
  if (!utilityId || !deps.onRoomUtilityTransform) return;
  const utility = getRoomUtilityByIdImpl(deps, utilityId);
  if (!utility || !(utility.parent instanceof THREE.Mesh)) return;
  const wall = utility.parent as THREE.Mesh;
  const wallLenMm = (wall.userData.wallLengthMm as number | undefined) ?? 1000;
  const wallHeightMm = (wall.userData.wallHeightMm as number | undefined) ?? 2600;
  const wallLenM = wallLenMm / 1000;
  let positionAlongWall = (utility.position.x + wallLenM / 2) * 1000;
  let heightMm = (utility.position.y + wallHeightMm / 2000) * 1000;
  positionAlongWall = Math.max(0, Math.min(wallLenMm, positionAlongWall));
  heightMm = Math.max(0, Math.min(wallHeightMm, heightMm));
  deps.onRoomUtilityTransform(utilityId, { positionAlongWall, heightMm });
}
