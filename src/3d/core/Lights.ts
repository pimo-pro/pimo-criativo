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
  /** Resolução do shadow map (2048 para qualidade, 1024 para performance). */
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
    // Ambient reduzido para não “lavar” as cores do MDF
    this.ambient = new THREE.AmbientLight(
      0xffffff,
      options.ambientIntensity ?? 0.4
    );

    this.hemisphere = new THREE.HemisphereLight(
      options.hemisphereSkyColor ?? 0xdfe7ff,
      options.hemisphereGroundColor ?? 0xf2f2f2,
      options.hemisphereIntensity ?? 0.35
    );

    // Key light: frontal diagonal, cor levemente quente, ângulo suave
    this.keyLight = new THREE.DirectionalLight(
      options.keyLightColor ?? 0xfff4e6,
      options.keyLightIntensity ?? 0.55
    );
    this.keyLight.position.set(4.2, 5.5, 4.2);
    this.keyLight.castShadow = true;
    const shadowSize = options.shadowMapSize ?? 2048;
    this.keyLight.shadow.mapSize.width = shadowSize;
    this.keyLight.shadow.mapSize.height = shadowSize;
    this.keyLight.shadow.radius = options.shadowRadius ?? 2.0;
    this.keyLight.shadow.bias = options.shadowBias ?? 0.0015;
    this.keyLight.shadow.normalBias = options.shadowNormalBias ?? 0.04;
    // Frustum ampliado para suportar múltiplas caixas lado a lado
    this.keyLight.shadow.camera.near = 0.1;
    this.keyLight.shadow.camera.far = 20;
    this.keyLight.shadow.camera.left = -4;
    this.keyLight.shadow.camera.right = 4;
    this.keyLight.shadow.camera.top = 3;
    this.keyLight.shadow.camera.bottom = -2;

    // Fill light: secundária suave, reduz áreas escuras, sem sombras
    this.fillLight = new THREE.DirectionalLight(
      options.fillLightColor ?? 0xe8ecf1,
      options.fillLightIntensity ?? 0.15
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
