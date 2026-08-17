import * as THREE from "three";
import type { ViewerBoxEntry } from "../types";

type SelectionOutlineControllerDeps = {
  scene: THREE.Scene;
  getBoxes: () => Map<string, ViewerBoxEntry>;
};

export class SelectionOutlineController {
  private readonly deps: SelectionOutlineControllerDeps;
  private readonly group: THREE.Group;
  private readonly material: THREE.LineBasicMaterial;
  private target: THREE.Object3D | null = null;
  private currentOpacity = 0;
  private targetOpacity = 0;
  private piecesSig: string | null = null;

  constructor(deps: SelectionOutlineControllerDeps) {
    this.deps = deps;
    this.material = new THREE.LineBasicMaterial({
      color: new THREE.Color("#7dd3fc"),
      linewidth: 1,
      opacity: 0.6,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.group = new THREE.Group();
    this.group.name = "selectionOutlinePieces";
    this.group.visible = false;
    this.deps.scene.add(this.group);
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  getMaterial(): THREE.LineBasicMaterial {
    return this.material;
  }

  setTarget(mesh: THREE.Object3D | null, opacity: number, colorHex: number): void {
    this.target = mesh;
    this.targetOpacity = opacity;
    if (!mesh) {
      this.clearHelpers();
      this.piecesSig = null;
      this.group.visible = false;
      return;
    }
    this.material.color.setHex(colorHex);
    this.material.needsUpdate = true;
    this.group.visible = true;
    this.updateGeometry(mesh);
  }

  updateFrame(): void {
    this.currentOpacity += (this.targetOpacity - this.currentOpacity) * 0.25;
    const shouldShow = this.currentOpacity > 0.02 && this.target;
    if (shouldShow && this.target) {
      this.group.visible = true;
      this.updateGeometry(this.target);
    } else if (!shouldShow) {
      this.group.visible = false;
    }
    this.material.opacity = Math.max(0, Math.min(1, this.currentOpacity));
    this.material.needsUpdate = true;
  }

  sanitizeStaleTarget(isObjectAttachedToScene: (_object: THREE.Object3D) => boolean): void {
    if (this.target && !isObjectAttachedToScene(this.target)) {
      this.target = null;
      this.piecesSig = null;
    }
  }

  hasStaleTarget(isObjectAttachedToScene: (_object: THREE.Object3D) => boolean): boolean {
    return Boolean(this.target && !isObjectAttachedToScene(this.target));
  }

  dispose(): void {
    this.clearHelpers();
    this.deps.scene.remove(this.group);
    this.material.dispose();
    this.target = null;
    this.piecesSig = null;
  }

  private hasVisibleAncestors(node: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = node;
    while (current) {
      if (!current.visible) return false;
      current = current.parent;
    }
    return true;
  }

  private clearHelpers(): void {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      if (child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        if (child.material && child.material !== this.material) {
          (child.material as THREE.Material).dispose();
        }
      }
    }
  }

  private isRemateTarget(target: THREE.Object3D): boolean {
    return (
      target.userData?.isRematePiece === true ||
      (typeof target.userData?.remateId === "string" && target.userData.remateId.length > 0)
    );
  }

  private getRemateDimensions(target: THREE.Object3D): { w: number; h: number; d: number } | null {
    if (!(target instanceof THREE.Mesh)) return null;
    const geo = target.geometry;
    if (!(geo instanceof THREE.BufferGeometry)) return null;
    geo.computeBoundingBox();
    const size = new THREE.Vector3();
    geo.boundingBox?.getSize(size);
    return {
      w: Math.max(0.001, size.x * target.scale.x),
      h: Math.max(0.001, size.y * target.scale.y),
      d: Math.max(0.001, size.z * target.scale.z),
    };
  }

  private getPiecesSignature(target: THREE.Object3D): string {
    if (this.isRemateTarget(target)) {
      const remateId = String(target.userData?.remateId ?? target.uuid);
      const dims = this.getRemateDimensions(target);
      return `remate:${remateId}:${dims?.w ?? 0}:${dims?.h ?? 0}:${dims?.d ?? 0}`;
    }
    const boxId =
      typeof target.userData?.boxId === "string" && target.userData.boxId.trim().length > 0
        ? target.userData.boxId.trim()
        : "";
    if (!boxId) return `${target.uuid}:no-boxId`;
    const entry = this.deps.getBoxes().get(boxId);
    if (!entry) return `${target.uuid}:no-entry`;
    return `${boxId}:${entry.width}:${entry.height}:${entry.depth}:${entry.carcassDepth ?? "u"}:${entry.cadOnly ? 1 : 0}`;
  }

  private rebuildPieceHelpers(target: THREE.Object3D): void {
    this.clearHelpers();

    if (this.isRemateTarget(target)) {
      if (target.userData?.isTampoPiece === true && target instanceof THREE.Mesh && target.geometry) {
        const edges = new THREE.EdgesGeometry(target.geometry);
        const wireframe = new THREE.LineSegments(edges, this.material);
        wireframe.name = "selection-outline-layout";
        wireframe.raycast = () => null;
        wireframe.frustumCulled = false;
        // Igual aos remates: copiamos matrixWorld no update. Sem isto o helper
        // volta à origem do mundo (selecção «flutuante» longe do tampo).
        wireframe.matrixAutoUpdate = false;
        wireframe.renderOrder =
          typeof target.userData?.remateOutlineRenderOrder === "number"
            ? target.userData.remateOutlineRenderOrder
            : 2001;
        this.group.add(wireframe);
        return;
      }
      const dims = this.getRemateDimensions(target);
      if (!dims) return;
      this.addWireframe(dims.w, dims.h, dims.d, {
        renderOrder:
          typeof target.userData?.remateOutlineRenderOrder === "number"
            ? target.userData.remateOutlineRenderOrder
            : 2001,
      });
      return;
    }

    const boxId =
      typeof target.userData?.boxId === "string" && target.userData.boxId.trim().length > 0
        ? target.userData.boxId.trim()
        : "";
    const entry = boxId ? this.deps.getBoxes().get(boxId) : undefined;
    if (!entry) return;

    this.addWireframe(
      Math.max(0.001, entry.width),
      Math.max(0.001, entry.height),
      Math.max(0.001, entry.carcassDepth ?? entry.depth),
      { renderOrder: 2001 }
    );
  }

  private addWireframe(
    width: number,
    height: number,
    depth: number,
    options: { renderOrder: number }
  ): void {
    const boxGeo = new THREE.BoxGeometry(width, height, depth);
    const edges = new THREE.EdgesGeometry(boxGeo);
    boxGeo.dispose();
    const wireframe = new THREE.LineSegments(edges, this.material);
    wireframe.name = "selection-outline-layout";
    wireframe.raycast = () => null;
    wireframe.frustumCulled = false;
    wireframe.renderOrder = options.renderOrder;
    wireframe.matrixAutoUpdate = false;
    this.group.add(wireframe);
  }

  private updateGeometry(target: THREE.Object3D): void {
    const sig = this.getPiecesSignature(target);
    if (this.piecesSig !== sig) {
      this.piecesSig = sig;
      this.rebuildPieceHelpers(target);
    }
    target.updateMatrixWorld(true);
    const show = this.hasVisibleAncestors(target);
    for (const child of this.group.children) {
      if (child instanceof THREE.LineSegments && child.name === "selection-outline-layout") {
        child.visible = show;
        if (show) {
          child.matrix.copy(target.matrixWorld);
        }
      }
    }
  }
}
