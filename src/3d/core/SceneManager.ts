import * as THREE from "three";
import { createGround, createGrid } from "./Environment";
import type { EnvironmentOptions } from "./Environment";

export type SceneOptions = {
  background?: string;
  environment?: EnvironmentOptions;
};

export class SceneManager {
  readonly scene: THREE.Scene;
  readonly root: THREE.Group;
  private ground: THREE.Mesh | null = null;
  private grid: THREE.GridHelper | null = null;

  constructor(options: SceneOptions = {}) {
    this.scene = new THREE.Scene();
    if (options.background) {
      this.scene.background = new THREE.Color(options.background);
    }
    this.root = new THREE.Group();
    this.scene.add(this.root);

    const environment = options.environment ?? {};
    this.ground = createGround(environment);
    this.scene.add(this.ground);
    if (environment.showGrid) {
      this.grid = createGrid(environment);
      this.scene.add(this.grid);
    }
  }

  add(object: THREE.Object3D) {
    this.root.add(object);
  }

  setGroundSize(width: number, depth: number) {
    if (!this.ground) return;
    this.ground.geometry.dispose();
    this.ground.geometry = new THREE.PlaneGeometry(width, depth);
  }

  setGroundPosition(x: number, z: number) {
    if (!this.ground) return;
    this.ground.position.set(x, 0, z);
  }

  dispose() {
    this.root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    if (this.grid) {
      if (Array.isArray(this.grid.material)) {
        this.grid.material.forEach((material) => material.dispose());
      } else {
        this.grid.material.dispose();
      }
      this.grid.geometry.dispose();
    }
    if (this.ground) {
      this.ground.geometry.dispose();
      if (Array.isArray(this.ground.material)) {
        this.ground.material.forEach((material) => material.dispose());
      } else {
        this.ground.material.dispose();
      }
    }
  }
}
