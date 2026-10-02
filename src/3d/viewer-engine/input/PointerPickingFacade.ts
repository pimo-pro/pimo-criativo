import * as THREE from "three";
import type { MouseMenuTarget } from "../../../ui/context-menu/ContextMenuEngine";
import type { DoorWindowConfig } from "../../../pimo-room/mesh/impl/types";
import type { ProjectRoomUtility } from "../room/roomEngineTypes";
import type { SelectedDivSep } from "../state/ViewerState";
import type { InternalSelectionHit } from "../selection";
import type { ViewerRaycastSystem } from "../raycast/ViewerRaycastSystem";
import { encodeSelectionIdFromLayerHit } from "../../../core/viewer/selectionHitEncoding";
import { remateSelectionId, rodapeSelectionId } from "../../../core/viewer/selectionIds";

export type PointerEventLike = { clientX: number; clientY: number };

type PointerPickingFacadeDeps = {
  raycastSystem: ViewerRaycastSystem;
  getPlacementMode: () => "door" | "window" | null;
  hasRoomElementPlacementHandler: () => boolean;
};

export class PointerPickingFacade {
  private readonly deps: PointerPickingFacadeDeps;

  constructor(deps: PointerPickingFacadeDeps) {
    this.deps = deps;
  }

  isPointerOnSelectableObject(event: PointerEventLike): boolean {
    return this.deps.raycastSystem.isPointerOnSelectableObject(event);
  }

  getPointerSelectionEncodedId(event: PointerEventLike): string | null {
    const hit = this.getContextMenuLayerHit(event);
    const fromHit = encodeSelectionIdFromLayerHit(hit);
    if (fromHit && !fromHit.startsWith("box:")) return fromHit;
    const remateId = this.getRemateIdAtPointer(event);
    if (remateId) return remateSelectionId(remateId);
    const rodapeId = this.getRodapeIdAtPointer(event);
    if (rodapeId) return rodapeSelectionId(rodapeId);
    return null;
  }

  getHighlightIntersects(event: PointerEventLike): THREE.Intersection[] {
    return this.deps.raycastSystem.getHighlightIntersects(event);
  }

  getBoxIdAtPointer(event: PointerEventLike): string | null {
    return this.deps.raycastSystem.getBoxIdAtPointer(event);
  }

  getBoxIdByMesh(mesh: THREE.Object3D): string | null {
    return this.deps.raycastSystem.getBoxIdByMesh(mesh);
  }

  getHematiIdAtPointer(event: PointerEventLike): string | null {
    return this.deps.raycastSystem.getHematiIdAtPointer(event);
  }

  getRodapeIdAtPointer(event: PointerEventLike): string | null {
    return this.deps.raycastSystem.getRodapeIdAtPointer(event);
  }

  getRemateIdAtPointer(event: PointerEventLike): string | null {
    return this.deps.raycastSystem.getRemateIdAtPointer(event);
  }

  getDivSepHitAtPointer(event: PointerEventLike): SelectedDivSep | null {
    return this.deps.raycastSystem.getDivSepHitAtPointer(event);
  }

  getInternalSelectionHit(event: PointerEventLike): InternalSelectionHit | null {
    return this.deps.raycastSystem.getInternalSelectionHit(event);
  }

  getPointerWorldHit(event: PointerEventLike): THREE.Vector3 | null {
    return this.deps.raycastSystem.getPointerWorldHit(event);
  }

  getTransformGizmoIntersections(event: PointerEventLike): number {
    return this.deps.raycastSystem.getTransformGizmoIntersections(event);
  }

  getDoorHitAtPointer(event: PointerEventLike): { boxId: string; doorLayerId: string } | null {
    return this.deps.raycastSystem.getDoorHitAtPointer(event);
  }

  getDrawerHitAtPointer(event: PointerEventLike): { boxId: string; drawerLayerId: string } | null {
    return this.deps.raycastSystem.getDrawerHitAtPointer(event);
  }

  getBoxBodyHitAtPointer(event: PointerEventLike): { boxId: string } | null {
    return this.deps.raycastSystem.getBoxBodyHitAtPointer(event);
  }

  getContextMenuLayerHit(event: PointerEventLike): MouseMenuTarget | null {
    return this.deps.raycastSystem.getContextMenuLayerHit(event);
  }

  getWallIdAtPointer(event: PointerEventLike): number | null {
    return this.deps.raycastSystem.getWallIdAtPointer(event);
  }

  getWallHitAtPointer(event: PointerEventLike): {
    wallId: number;
    config: DoorWindowConfig;
    type: "door" | "window";
  } | null {
    const mode = this.deps.getPlacementMode();
    if (!mode || !this.deps.hasRoomElementPlacementHandler()) return null;
    return this.deps.raycastSystem.getWallPlacementHit(event, mode);
  }

  getRoomElementAtPointer(event: PointerEventLike): {
    elementId: string;
    wallId: number;
    type: "door" | "window";
    config: DoorWindowConfig;
  } | null {
    return this.deps.raycastSystem.getRoomElementAtPointer(event);
  }

  getWallIdInFrontOfCamera(): number | null {
    return this.deps.raycastSystem.getWallIdInFrontOfCamera();
  }

  getRoomUtilityAtPointer(deps: {
    event: PointerEventLike;
    canvas: HTMLCanvasElement;
    pointer: THREE.Vector2;
    raycaster: THREE.Raycaster;
    camera: THREE.Camera;
    roomBoxWalls: Array<{ id: number; mesh: THREE.Mesh }>;
  }): {
    utilityId: string;
    wallId: number;
    config: ProjectRoomUtility;
  } | null {
    const rect = deps.canvas.getBoundingClientRect();
    deps.pointer.x = ((deps.event.clientX - rect.left) / rect.width) * 2 - 1;
    deps.pointer.y = -((deps.event.clientY - rect.top) / rect.height) * 2 + 1;
    deps.raycaster.setFromCamera(deps.pointer, deps.camera);
    const roots: THREE.Object3D[] = [];
    deps.roomBoxWalls.forEach((entry) => {
      entry.mesh.children.forEach((child) => {
        if (child.userData?.roomUtilityId) roots.push(child);
      });
    });
    const hit = deps.raycaster.intersectObjects(roots, true)[0];
    if (!hit) return null;
    let node: THREE.Object3D | null = hit.object;
    while (node && !node.userData?.roomUtilityId) node = node.parent;
    if (!node) return null;
    const wallMesh = node.parent instanceof THREE.Mesh ? node.parent : null;
    const wallEntry = wallMesh ? deps.roomBoxWalls.find((entry) => entry.mesh === wallMesh) : null;
    const config = node.userData.roomUtility as ProjectRoomUtility | undefined;
    if (!wallEntry || !config) return null;
    return { utilityId: config.id, wallId: wallEntry.id, config };
  }
}
