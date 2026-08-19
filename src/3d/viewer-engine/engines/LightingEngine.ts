import { LightingEngine } from "../lighting/LightingEngine";
import type { BaseLightIntensities } from "../lighting/LightingEngine";
import type { Lights } from "../lighting/Lights";

export function createViewerLightingEngine(lights: Lights, base: BaseLightIntensities): LightingEngine {
  return new LightingEngine(lights, base);
}

export function ensureViewerLightingEngine(
  current: LightingEngine | null,
  lights: Lights,
  base: BaseLightIntensities
): LightingEngine {
  return current ?? createViewerLightingEngine(lights, base);
}

