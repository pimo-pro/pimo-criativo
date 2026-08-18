import * as THREE from "three";

export type LightsOptions = {
  ambientIntensity?: number;
  hemisphereIntensity?: number;
  hemisphereSkyColor?: number;
  hemisphereGroundColor?: number;
  /** Luz principal (key) — frontal diagonal; projeta sombra. */
  keyLightIntensity?: number;
  keyLightColor?: number;
  /** Luz de preenchimento (fill) — suave, reduz áreas escuras, sem sombras. */
  fillLightIntensity?: number;
  fillLightColor?: number;
  /** Luz de contorno (rim) — atrás do módulo, destaca bordas. */
  rimLightIntensity?: number;
  /** Resolução do shadow map (4096 desktop, 1024 mobile — definido pelo Viewer). */
  shadowMapSize?: number;
  shadowBias?: number;
  shadowNormalBias?: number;
  shadowRadius?: number;
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
    // Ambient suave: iluminação base sem "lavar" as cores do MDF
    this.ambient = new THREE.AmbientLight(
      0xffffff,
      options.ambientIntensity ?? 0.46
    );

    // Hemisphere: equilíbrio céu/chão, sem sombras duras
    this.hemisphere = new THREE.HemisphereLight(
      options.hemisphereSkyColor ?? 0xe8eeff,
      options.hemisphereGroundColor ?? 0xebeef2,
      options.hemisphereIntensity ?? 0.56
    );

    // Key light: frontal diagonal, intensidade moderada para evitar brilho excessivo; projeta sombra
    this.keyLight = new THREE.DirectionalLight(
      options.keyLightColor ?? 0xfff8f0,
      options.keyLightIntensity ?? 0.52
    );
    this.keyLight.position.set(5, 6, 5);
    this.keyLight.target.position.set(0, 0.5, 0);
    scene.add(this.keyLight.target);
    this.keyLight.castShadow = true;
    const shadowSize = options.shadowMapSize ?? 4096;
    this.keyLight.shadow.mapSize.width = shadowSize;
    this.keyLight.shadow.mapSize.height = shadowSize;
    this.keyLight.shadow.radius = options.shadowRadius ?? 6;
    this.keyLight.shadow.bias = options.shadowBias ?? -0.0002;
    this.keyLight.shadow.normalBias = options.shadowNormalBias ?? 0.06;
    this.keyLight.shadow.camera.near = 0.1;
    this.keyLight.shadow.camera.far = 25;
    this.keyLight.shadow.camera.left = -8;
    this.keyLight.shadow.camera.right = 8;
    this.keyLight.shadow.camera.top = 8;
    this.keyLight.shadow.camera.bottom = -8;

    // Fill light: suave, reduz áreas escuras, sem sombras
    this.fillLight = new THREE.DirectionalLight(
      options.fillLightColor ?? 0xe8ecf1,
      options.fillLightIntensity ?? 0.3
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
