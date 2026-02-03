import * as THREE from "three";

export type LightsOptions = {
  ambientIntensity?: number;
  hemisphereIntensity?: number;
  /** Luz principal (key) — frontal diagonal; projeta sombra. */
  keyLightIntensity?: number;
  /** Luz de preenchimento (fill) — lado oposto, suaviza sombras. */
  fillLightIntensity?: number;
  /** Luz de contorno (rim) — atrás do módulo, destaca bordas. */
  rimLightIntensity?: number;
  /** Resolução do shadow map (2048 para performance, 4096 para apresentação). */
  shadowMapSize?: number;
};

export class Lights {
  readonly ambient: THREE.AmbientLight;
  readonly hemisphere: THREE.HemisphereLight;
  /** Luz principal: frontal diagonal, intensidade moderada, projeta sombra. */
  readonly keyLight: THREE.DirectionalLight;
  /** Luz de preenchimento: lado oposto, suave, sem sombra. */
  readonly fillLight: THREE.DirectionalLight;
  /** Luz de contorno: atrás do módulo, destaca arestas. */
  readonly rimLight: THREE.DirectionalLight;

  constructor(scene: THREE.Scene, options: LightsOptions = {}) {
    // Ambient reduzido para não “lavar” as cores do MDF
    this.ambient = new THREE.AmbientLight(
      0xffffff,
      options.ambientIntensity ?? 0.55
    );

    this.hemisphere = new THREE.HemisphereLight(
      0xddeeff,
      0x2b2b2b,
      options.hemisphereIntensity ?? 0.48
    );

    // Key light: frontal diagonal, intensidade moderada
    this.keyLight = new THREE.DirectionalLight(
      0xffffff,
      options.keyLightIntensity ?? 0.46
    );
    this.keyLight.position.set(5.4, 6.0, 5.4);
    this.keyLight.castShadow = true;
    const shadowSize = options.shadowMapSize ?? 1024;
    this.keyLight.shadow.mapSize.width = shadowSize;
    this.keyLight.shadow.mapSize.height = shadowSize;
    // Suavidade do penumbra (PCF) reduzida para diminuir custo.
    this.keyLight.shadow.radius = 1.0;
    // Suaviza sombras: aumenta bias para reduzir artefatos e sombras duras
    this.keyLight.shadow.bias = 0.002;
    this.keyLight.shadow.normalBias = 0.05;
    // Frustum ampliado para suportar múltiplas caixas lado a lado
    this.keyLight.shadow.camera.near = 0.1;
    this.keyLight.shadow.camera.far = 20;
    this.keyLight.shadow.camera.left = -4;
    this.keyLight.shadow.camera.right = 4;
    this.keyLight.shadow.camera.top = 3;
    this.keyLight.shadow.camera.bottom = -2;

    // Fill light: lado oposto, suave, sem sombra
    this.fillLight = new THREE.DirectionalLight(
      0xe8f0ff,
      options.fillLightIntensity ?? 0.6
    );
    this.fillLight.position.set(-3, 3, 2.5);

    // Rim light: atrás do módulo, destaca bordas
    const rimIntensity = options.rimLightIntensity ?? 0.16;
    this.rimLight = new THREE.DirectionalLight(0xffffff, rimIntensity);
    this.rimLight.position.set(-2, 2.5, -4);

    scene.add(this.ambient, this.hemisphere, this.keyLight, this.fillLight);
    if (rimIntensity > 0) {
      scene.add(this.rimLight);
    }
  }

  setShadowMapSize(size: number): void {
    this.keyLight.shadow.mapSize.width = size;
    this.keyLight.shadow.mapSize.height = size;
  }
}
