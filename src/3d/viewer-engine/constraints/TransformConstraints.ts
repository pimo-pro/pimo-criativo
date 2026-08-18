import * as THREE from "three";
import type { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import type { ViewerBoxEntry } from "../types";
import { setBox3FromObjectExcludingLayoutProxy } from "../box/boxAabbUtils";
import { keepModelInsideRoom, preventModelWallIntersection } from "../../collision/ModelCollision";
import type { SnapDebugData } from "../../snapping/ModelWallSnap";

type RoomBoundsLike = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
  centerX: number;
  centerZ: number;
};

export type ClampTransformContext = {
  transformControls: TransformControls | null;
  selectedBoxId: string | null;
  boxes: Map<string, ViewerBoxEntry>;
  currentTool: string;
  lockEnabled: boolean;
  roomBounds: RoomBoundsLike | null;
  roomBoxWalls: Array<{ id: number; mesh: THREE.Mesh }>;
  selectedWallIndex: number | null;
  applyFloorConstraint: (_obj: THREE.Object3D) => void;
  applyRoomConstraint: (_obj: THREE.Object3D, _options?: { ignoreY?: boolean }) => void;
  isMeshInsideOrTouchingRoom: (_obj: THREE.Object3D) => boolean;
  clearSnapState: (_obj: THREE.Object3D) => void;
  shouldUseFeetLock: (_entry: ViewerBoxEntry) => boolean;
  getFixedYForCabinet: (_entry: ViewerBoxEntry) => number;
  updateBoxesIntersectingWalls: () => void;
  setLastSnapDebugData: (_data: SnapDebugData | null) => void;
  /** Único caminho de ModelWallSnap no translate de caixa (orquestrado por SnapEngine). */
  snapMeshToNearestMainWall: (
    _mesh: THREE.Object3D,
    _mainWalls: THREE.Mesh[]
  ) => { debug: SnapDebugData };
};

export class TransformConstraints {
  clampTransform(ctx: ClampTransformContext): void {
    if (!ctx.transformControls) return;
    const obj = ctx.transformControls.object;
    if (!obj) return;

    if (ctx.selectedBoxId && ctx.boxes.has(ctx.selectedBoxId)) {
      const entry = ctx.boxes.get(ctx.selectedBoxId)!;
      if (obj === entry.mesh) {
        if (ctx.currentTool === "translate") {
          const snapData = obj.userData as Record<string, unknown>;
          const currentPos = obj.position.clone();
          const lastPos =
            snapData.lastSnapPosition instanceof THREE.Vector3
              ? snapData.lastSnapPosition.clone()
              : currentPos.clone();
          const movementDirection = currentPos.sub(lastPos);
          if (movementDirection.lengthSq() > 1e-10) {
            movementDirection.normalize();
          }
          snapData.movementDirection = movementDirection.clone();
          snapData.lastSnapPosition = obj.position.clone();

          obj.updateMatrixWorld(true);
          ctx.applyFloorConstraint(obj);
          if (ctx.lockEnabled) {
            this.applyCollisionConstraint(obj, ctx.boxes, ctx.selectedBoxId);
          }
          if (ctx.roomBounds && ctx.lockEnabled && ctx.isMeshInsideOrTouchingRoom(obj)) {
            const wallsMain = ctx.roomBoxWalls
              .map((w) => w.mesh)
              .filter((w) => w.userData?.isMainWall === true);
            const allRoomWalls = ctx.roomBoxWalls.map((w) => w.mesh);

            const snapResult = ctx.snapMeshToNearestMainWall(obj, wallsMain);
            ctx.setLastSnapDebugData(snapResult.debug);
            preventModelWallIntersection(obj, allRoomWalls);
            keepModelInsideRoom(obj, ctx.roomBounds);
            ctx.applyRoomConstraint(obj, { ignoreY: entry.manualPosition });
          } else {
            ctx.clearSnapState(obj);
            ctx.setLastSnapDebugData(null);
          }
          if (ctx.shouldUseFeetLock(entry) && !entry.manualPosition) {
            obj.position.y = ctx.getFixedYForCabinet(entry);
          }
          ctx.updateBoxesIntersectingWalls();
        }
        return;
      }
    }

    const wallEntry =
      ctx.selectedWallIndex !== null
        ? ctx.roomBoxWalls.find((w) => w.id === ctx.selectedWallIndex)
        : null;
    if (wallEntry?.mesh === obj) {
      if (ctx.currentTool === "translate") {
        const wall = obj as THREE.Mesh;
        const heightM = ((wall.userData.wallHeightMm as number | undefined) ?? 2700) * 0.001;
        if (wall.position.y < heightM / 2) wall.position.y = heightM / 2;
      } else if (ctx.currentTool === "rotate") {
        (obj as THREE.Mesh).rotation.x = 0;
        (obj as THREE.Mesh).rotation.z = 0;
      }
    }
  }

  applyCollisionConstraint(
    movingMesh: THREE.Object3D,
    boxes: Map<string, ViewerBoxEntry>,
    selectedBoxId: string | null,
    excludeBoxIds?: ReadonlySet<string>
  ): void {
    const maxIterations = 8;
    for (let iter = 0; iter < maxIterations; iter++) {
      movingMesh.updateMatrixWorld(true);
      const movingBox = new THREE.Box3();
      setBox3FromObjectExcludingLayoutProxy(movingBox, movingMesh);
      let anyOverlap = false;
      boxes.forEach((entry, boxId) => {
        if (boxId === selectedBoxId) return;
        if (excludeBoxIds?.has(boxId)) return;
        entry.mesh.updateMatrixWorld(true);
        const otherBox = new THREE.Box3();
        setBox3FromObjectExcludingLayoutProxy(otherBox, entry.mesh);
        if (!movingBox.intersectsBox(otherBox)) return;
        anyOverlap = true;

        const overlapX = Math.max(
          0,
          Math.min(movingBox.max.x, otherBox.max.x) - Math.max(movingBox.min.x, otherBox.min.x)
        );
        const overlapZ = Math.max(
          0,
          Math.min(movingBox.max.z, otherBox.max.z) - Math.max(movingBox.min.z, otherBox.min.z)
        );
        const overlapY = Math.max(
          0,
          Math.min(movingBox.max.y, otherBox.max.y) - Math.max(movingBox.min.y, otherBox.min.y)
        );
        const minOverlap = Math.min(overlapX, overlapZ, overlapY);
        if (minOverlap <= 0) return;

        const movingCenter = new THREE.Vector3();
        movingBox.getCenter(movingCenter);
        const otherCenter = new THREE.Vector3();
        otherBox.getCenter(otherCenter);

        if (minOverlap === overlapX) {
          const move =
            movingCenter.x < otherCenter.x
              ? otherBox.min.x - movingBox.max.x
              : otherBox.max.x - movingBox.min.x;
          movingMesh.position.x += move;
        } else if (minOverlap === overlapZ) {
          const move =
            movingCenter.z < otherCenter.z
              ? otherBox.min.z - movingBox.max.z
              : otherBox.max.z - movingBox.min.z;
          movingMesh.position.z += move;
        } else {
          const move =
            movingCenter.y < otherCenter.y
              ? otherBox.min.y - movingBox.max.y
              : otherBox.max.y - movingBox.min.y;
          movingMesh.position.y += move;
        }
      });
      if (!anyOverlap) break;
    }
  }
}
