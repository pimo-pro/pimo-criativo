import type { ViewerOptions } from "../3d/core/Viewer";

/**
 * Configurações padronizadas do viewer 3D — modo principal.
 * Iluminação equilibrada, sombras suaves, materiais PBR, tone mapping e câmera fluida.
 */
export const DEFAULT_VIEWER_OPTIONS: Omit<ViewerOptions, "background" | "skipInitialBox"> = {
  enableControls: true,
  renderer: {
    antialias: true,
    toneMappingExposure: 1.05,
  },
  lights: {
    ambientIntensity: 0.32,
    hemisphereIntensity: 0.4,
    keyLightIntensity: 0.62,
    fillLightIntensity: 0.18,
    rimLightIntensity: 0.14,
    shadowMapSize: 2048,
    shadowBias: 0.0008,
    shadowNormalBias: 0.03,
    shadowRadius: 4,
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
    minDistance: 1.0,
    maxDistance: 40,
    minPolarAngle: Math.PI * 0.12,
    maxPolarAngle: Math.PI * 0.48,
  },
  environment: {
    groundSize: 25,
    groundColor: "#d4dae2",
  },
};

export const VIEWER_BACKGROUND = "#0f172a" as const;
