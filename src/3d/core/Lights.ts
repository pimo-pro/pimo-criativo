import * as THREE from "three";

export type LightsOptions = {
  ambientIntensity?: number;
  hemisphereIntensity?: number;
  directionalIntensity?: number;
};

export class Lights {
  readonly ambient: THREE.AmbientLight;
  readonly hemisphere: THREE.HemisphereLight;
  readonly directional: THREE.DirectionalLight;

  constructor(scene: THREE.Scene, options: LightsOptions = {}) {
    this.ambient = new THREE.AmbientLight(0xffffff, options.ambientIntensity ?? 0.4);
    this.hemisphere = new THREE.HemisphereLight(0xddeeff, 0x2b2b2b, options.hemisphereIntensity ?? 0.6);
    this.directional = new THREE.DirectionalLight(0xffffff, options.directionalIntensity ?? 1.1);
    this.directional.position.set(4, 6, 3);
    this.directional.castShadow = true;
    this.directional.shadow.mapSize.width = 2048;
    this.directional.shadow.mapSize.height = 2048;
    this.directional.shadow.radius = 4;
    this.directional.shadow.bias = -0.0002;

    scene.add(this.ambient, this.hemisphere, this.directional);
  }
}
