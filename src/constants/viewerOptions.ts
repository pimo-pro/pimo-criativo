import type { ViewerOptions } from "../3d/core/Viewer";

/**
 * Configurações padronizadas do viewer 3D — modo realista.
 * Usadas pelo Workspace (página principal) e DevActions para manter
 * iluminação, controles e comportamento idênticos.
 * Inclui: sombras suaves, materiais PBR, tone mapping, iluminação profissional.
 */
export const DEFAULT_VIEWER_OPTIONS: Omit<ViewerOptions, "background" | "skipInitialBox"> = {
  enableControls: true,
  /** HDRI para reflexos e luz ambiente realista */
  environmentMap: "/hdr/studio_neutral.hdr",
  renderer: {
    antialias: true,
    toneMappingExposure: 1.0,
  },
  lights: {
    ambientIntensity: 0.46,
    hemisphereIntensity: 0.45,
    keyLightIntensity: 0.38,
    fillLightIntensity: 0.6,
    rimLightIntensity: 0.16,
    shadowMapSize: 1024,
  },
  camera: {
    fov: 50,
    near: 0.01,
    far: 5000,
    position: { x: 3, y: 2.2, z: 5.5 },
  },
  controls: {
    enableDamping: true,
    dampingFactor: 0.06,
    minDistance: 0.8,
    maxDistance: 15,
    minPolarAngle: Math.PI * 0.12,
    maxPolarAngle: Math.PI * 0.48,
  },
  environment: {
    groundSize: 25,
    groundColor: "#e5e7eb",
  },
};

export const VIEWER_BACKGROUND = "#0f172a" as const;
