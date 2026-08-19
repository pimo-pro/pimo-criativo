import * as THREE from "three";
import { createGround, createGrid } from "../environment";
import type { EnvironmentOptions } from "../environment";

export type SceneOptions = {
  background?: string;
  environment?: EnvironmentOptions;
};

export class SceneManager {
  readonly scene: THREE.Scene;
  readonly root: THREE.Group;
  private ground: THREE.Mesh | null = null;
  private grid: THREE.GridHelper | null = null;
  private reflectionsEnabled = false;
  private reflectionCubeTarget: THREE.WebGLCubeRenderTarget | null = null;
  private reflectionCubeCamera: THREE.CubeCamera | null = null;
  private materialQuality: "standard" | "premium" | "lacquered" = "standard";

  constructor(options: SceneOptions = {}) {
    this.scene = new THREE.Scene();
    if (options.background) {
      this.scene.background = new THREE.Color(options.background);
    }
    this.root = new THREE.Group();
    this.scene.add(this.root);

    const environment = options.environment ?? {};
    this.ground = createGround(environment);
    this.ground.receiveShadow = true;
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

  setBackground(color: string | null) {
    this.scene.background = color ? new THREE.Color(color) : null;
  }

  setGroundAppearance(options: { color?: string; roughness?: number; metalness?: number }) {
    if (!this.ground) return;
    const material = this.ground.material;
    if (!(material instanceof THREE.MeshStandardMaterial)) return;
    if (options.color) material.color.set(options.color);
    if (typeof options.roughness === "number") material.roughness = options.roughness;
    if (typeof options.metalness === "number") material.metalness = options.metalness;
    material.needsUpdate = true;
  }

  setGroundVisible(visible: boolean) {
    if (!this.ground) return;
    this.ground.visible = visible;
  }

  getGroundVisible(): boolean {
    return this.ground?.visible ?? false;
  }

  setGridVisible(visible: boolean) {
    if (!this.grid) return;
    this.grid.visible = visible;
  }

  getGridVisible(): boolean {
    return this.grid?.visible ?? false;
  }

  setMaterialQuality(quality: "standard" | "premium" | "lacquered") {
    this.materialQuality = quality;
    if (quality === "premium") {
      this.setGroundAppearance({ color: "#d8dee8", roughness: 0.78, metalness: 0.06 });
      return;
    }
    if (quality === "lacquered") {
      this.setGroundAppearance({ color: "#e5e7eb", roughness: 0.7, metalness: 0.1 });
      return;
    }
    this.setGroundAppearance({ color: "#d4dae2", roughness: 0.92, metalness: 0 });
  }

  getMaterialQuality(): "standard" | "premium" | "lacquered" {
    return this.materialQuality;
  }

  private ensureReflectionProbe(renderer: THREE.WebGLRenderer) {
    if (this.reflectionCubeCamera && this.reflectionCubeTarget) return;
    const isWebGL2 = renderer.capabilities.isWebGL2;
    const size = isWebGL2 ? 512 : 128;
    this.reflectionCubeTarget = new THREE.WebGLCubeRenderTarget(size, {
      type: isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      colorSpace: THREE.SRGBColorSpace,
    });
    this.reflectionCubeCamera = new THREE.CubeCamera(0.1, 200, this.reflectionCubeTarget);
    this.scene.add(this.reflectionCubeCamera);
  }

  private disposeReflectionProbe() {
    if (this.reflectionCubeCamera) {
      this.scene.remove(this.reflectionCubeCamera);
      this.reflectionCubeCamera = null;
    }
    if (this.reflectionCubeTarget) {
      this.reflectionCubeTarget.dispose();
      this.reflectionCubeTarget = null;
    }
  }

  setReflectionsEnabled(enabled: boolean, renderer: THREE.WebGLRenderer) {
    this.reflectionsEnabled = Boolean(enabled);
    if (!this.reflectionsEnabled) {
      this.scene.environment = null;
      this.disposeReflectionProbe();
      return;
    }
    this.ensureReflectionProbe(renderer);
    this.updateReflectionProbe(renderer, { force: true });
  }

  getReflectionsEnabled(): boolean {
    return this.reflectionsEnabled;
  }

  updateReflectionProbe(
    renderer: THREE.WebGLRenderer,
    options?: { center?: { x: number; y: number; z: number }; force?: boolean }
  ) {
    if (!this.reflectionsEnabled) return;
    this.ensureReflectionProbe(renderer);
    if (!this.reflectionCubeCamera || !this.reflectionCubeTarget) return;

    const center = options?.center ?? { x: 0, y: 1.2, z: 0 };
    this.reflectionCubeCamera.position.set(center.x, center.y, center.z);

    // Captura sem o environment atual: evita que materiais especulares realimentem
    // a própria captura seguinte (loop de feedback que clareava a cena progressivamente
    // a cada recaptura periódica). A sonda reflete sempre a cena tal como os pontos de
    // luz diretos a iluminam, nunca a sua própria iluminação de ambiente anterior.
    const previousEnvironment = this.scene.environment;
    this.scene.environment = null;
    this.reflectionCubeCamera.update(renderer, this.scene);
    this.scene.environment = previousEnvironment;

    this.scene.environment = this.reflectionCubeTarget.texture;
    if (options?.force) {
      this.scene.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        const mat = node.material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => {
            if (m instanceof THREE.MeshStandardMaterial) m.needsUpdate = true;
          });
        } else if (mat instanceof THREE.MeshStandardMaterial) {
          mat.needsUpdate = true;
        }
      });
    }
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
    this.disposeReflectionProbe();
  }
}
