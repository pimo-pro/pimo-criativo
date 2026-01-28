import * as THREE from "three";

export type CameraOptions = {
  fov?: number;
  near?: number;
  far?: number;
  position?: { x: number; y: number; z: number };
  target?: { x: number; y: number; z: number };
};

export class CameraManager {
  readonly camera: THREE.PerspectiveCamera;
  private target: THREE.Vector3;

  constructor(options: CameraOptions = {}) {
    this.camera = new THREE.PerspectiveCamera(options.fov ?? 50, 1, options.near ?? 0.1, options.far ?? 1000);
    const position = options.position ?? { x: 3, y: 2, z: 5 };
    this.camera.position.set(position.x, position.y, position.z);
    const target = options.target ?? { x: 0, y: 0.5, z: 0 };
    this.target = new THREE.Vector3(target.x, target.y, target.z);
    this.camera.lookAt(this.target);
  }

  setSize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  getTarget() {
    return this.target;
  }

  setPosition(x: number, y: number, z: number) {
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.target);
  }

  setTarget(x: number, y: number, z: number) {
    this.target.set(x, y, z);
    this.camera.lookAt(this.target);
  }
}
