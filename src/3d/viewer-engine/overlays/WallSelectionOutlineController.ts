/**
 * STUB no-op — sistema Sala removido (feature/sala-rebuild-opensource).
 */
import * as THREE from "three";

export type WallSelectionOutlineTarget = {
  mesh: THREE.Mesh;
} | null;

export class WallSelectionOutlineController {
  private readonly scene: THREE.Scene;
  private readonly helper: THREE.BoxHelper;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.helper = new THREE.BoxHelper(new THREE.Object3D(), 0x3b82f6);
    this.helper.visible = false;
    this.scene.add(this.helper);
  }

  getHelper(): THREE.BoxHelper {
    return this.helper;
  }

  update(_target: WallSelectionOutlineTarget): void {
    this.helper.visible = false;
  }

  dispose(): void {
    this.scene.remove(this.helper);
    this.helper.geometry.dispose();
    if (this.helper.material instanceof THREE.Material) {
      this.helper.material.dispose();
    }
  }
}
