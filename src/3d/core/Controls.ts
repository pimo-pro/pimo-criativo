import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as THREE from "three";

export type ControlsOptions = {
  enableDamping?: boolean;
  dampingFactor?: number;
  minDistance?: number;
  maxDistance?: number;
  minPolarAngle?: number;
  maxPolarAngle?: number;
};

export class Controls {
  readonly controls: OrbitControls;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement, options: ControlsOptions = {}) {
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = options.enableDamping ?? true;
    this.controls.dampingFactor = options.dampingFactor ?? 0.08;
    if (options.minDistance !== undefined) this.controls.minDistance = options.minDistance;
    if (options.maxDistance !== undefined) this.controls.maxDistance = options.maxDistance;
    if (options.minPolarAngle !== undefined) this.controls.minPolarAngle = options.minPolarAngle;
    if (options.maxPolarAngle !== undefined) this.controls.maxPolarAngle = options.maxPolarAngle;
  }

  update() {
    this.controls.update();
  }

  dispose() {
    this.controls.dispose();
  }
}
