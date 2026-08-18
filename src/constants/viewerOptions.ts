
/**
 * Configurações padronizadas do viewer 3D — modo principal.
 * Iluminação equilibrada, sombras soft (PCF), tone mapping e gamma para qualidade visual.
 */
export const DEFAULT_VIEWER_OPTIONS = {
  enableControls: true,
  renderer: {
    antialias: true,
    toneMappingExposure: 1.0,
  },
  lights: {
    ambientIntensity: 0.46,
    hemisphereIntensity: 0.56,
    keyLightIntensity: 0.52,
    fillLightIntensity: 0.3,
    rimLightIntensity: 0.16,
    shadowMapSize: 4096,
    shadowBias: -0.0002,
    shadowNormalBias: 0.06,
    shadowRadius: 6,
  },
  camera: {
    fov: 45,
    near: 0.01,
    far: 5000,
    position: { x: 3, y: 2.2, z: 5.5 },
  },
  controls: {
    enableDamping: true,
    dampingFactor: 0.08,
    minDistance: 0.01,
    maxDistance: 120,
    minPolarAngle: Math.PI * 0.02,
    maxPolarAngle: Math.PI * 0.98,
  },
  environment: {
    groundSize: 25,
    groundColor: "#d4dae2",
  },
};

export const VIEWER_BACKGROUND = "#0f172a" as const;
