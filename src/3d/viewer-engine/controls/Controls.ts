import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as THREE from "three";
import { applyMouseInputMappingToOrbitControls, getMouseInputMapping } from "./MouseInputMapper";

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
    this.controls.dampingFactor = options.dampingFactor ?? 0.05;
    this.controls.minDistance = options.minDistance ?? 0.01;
    this.controls.maxDistance = options.maxDistance ?? 2000;
    if (options.minPolarAngle !== undefined) this.controls.minPolarAngle = options.minPolarAngle;
    if (options.maxPolarAngle !== undefined) this.controls.maxPolarAngle = options.maxPolarAngle;
    applyMouseInputMappingToOrbitControls(this.controls, getMouseInputMapping());
  }

  update() {
    this.controls.update();
  }

  dispose() {
    this.controls.dispose();
  }
}
