/**
 * LightingEngine (Z-01.2.7 A) — intensidade global, sombras e lerp ultra.
 * Não altera a construção das luzes (`Lights.ts`).
 */
import type { Lights } from "./Lights";

export type LightIntensityProfile = {
  key: number;
  fill: number;
  ambient: number;
  rim: number;
  castShadow: boolean;
  shadowRadius: number;
};

export type BaseLightIntensities = {
  ambient: number;
  hemisphere: number;
  key: number;
  fill: number;
  rim: number;
};

const LIGHT_LERP_FACTOR = 0.14;

export function clampGlobalLightIntensity(value: number): number {
  return Math.min(1.4, Math.max(0.6, Number.isFinite(value) ? value : 1));
}

export function clampShadowIntensity(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 1));
}

export function scaleLightProfile(
  profile: LightIntensityProfile,
  factor: number
): LightIntensityProfile {
  return {
    ...profile,
    key: profile.key * factor,
    fill: profile.fill * factor,
    ambient: profile.ambient * factor,
    rim: profile.rim * factor,
  };
}

export class LightingEngine {
  globalIntensity = 1;
  shadowIntensity = 1;
  ultraLightState: LightIntensityProfile | null = null;
  ultraLightTarget: LightIntensityProfile | null = null;
  readonly lights: Lights;
  readonly base: BaseLightIntensities;

  constructor(lights: Lights, base: BaseLightIntensities) {
    this.lights = lights;
    this.base = base;
  }

  static ensure(
    current: LightingEngine | null,
    lights: Lights,
    base: BaseLightIntensities
  ): LightingEngine {
    return current ?? new LightingEngine(lights, base);
  }

  applyGlobalIntensity(value: number, ultraActive: boolean): number {
    this.globalIntensity = clampGlobalLightIntensity(value);
    if (ultraActive && this.ultraLightTarget && this.ultraLightState) {
      this.ultraLightTarget = scaleLightProfile(this.ultraLightState, this.globalIntensity);
      return this.globalIntensity;
    }
    this.lights.ambient.intensity = this.base.ambient * this.globalIntensity;
    this.lights.hemisphere.intensity = this.base.hemisphere * this.globalIntensity;
    this.lights.keyLight.intensity = this.base.key * this.globalIntensity;
    this.lights.fillLight.intensity = this.base.fill * this.globalIntensity;
    this.lights.rimLight.intensity = this.base.rim * this.globalIntensity;
    return this.globalIntensity;
  }

  applyShadowIntensity(value: number): number {
    const clamped = clampShadowIntensity(value);
    this.shadowIntensity = clamped;
    this.lights.keyLight.shadow.intensity = clamped;
    return clamped;
  }

  beginUltraLights(isAggressive: boolean): LightIntensityProfile {
    if (!this.ultraLightState) {
      this.ultraLightState = {
        key: this.base.key * (isAggressive ? 1.08 : 1.18),
        fill: this.base.fill * (isAggressive ? 1.03 : 1.12),
        ambient: this.base.ambient * (isAggressive ? 1.02 : 1.08),
        rim: this.base.rim * (isAggressive ? 0.95 : 1.2),
        castShadow: this.lights.keyLight.castShadow,
        shadowRadius: isAggressive ? 4.5 : 6.5,
      };
    }
    this.ultraLightTarget = scaleLightProfile(this.ultraLightState, this.globalIntensity);
    this.lights.keyLight.castShadow = true;
    this.lights.keyLight.shadow.radius = this.ultraLightTarget.shadowRadius;
    return this.ultraLightTarget;
  }

  endUltraLights(): void {
    if (this.ultraLightState) {
      this.ultraLightTarget = scaleLightProfile(this.ultraLightState, this.globalIntensity);
    } else {
      this.ultraLightTarget = null;
    }
    this.ultraLightState = null;
  }

  lerpToTarget(): void {
    if (!this.ultraLightTarget) return;
    const t = LIGHT_LERP_FACTOR;
    const target = this.ultraLightTarget;
    const key = this.lights.keyLight.intensity;
    const fill = this.lights.fillLight.intensity;
    const ambient = this.lights.ambient.intensity;
    const rim = this.lights.rimLight.intensity;
    const radius = this.lights.keyLight.shadow.radius;

    this.lights.keyLight.intensity = key + (target.key - key) * t;
    this.lights.fillLight.intensity = fill + (target.fill - fill) * t;
    this.lights.ambient.intensity = ambient + (target.ambient - ambient) * t;
    this.lights.rimLight.intensity = rim + (target.rim - rim) * t;
    this.lights.keyLight.shadow.radius = radius + (target.shadowRadius - radius) * t;

    const snap = 0.002;
    if (
      Math.abs(this.lights.keyLight.intensity - target.key) < snap &&
      Math.abs(this.lights.fillLight.intensity - target.fill) < snap &&
      Math.abs(this.lights.ambient.intensity - target.ambient) < snap &&
      Math.abs(this.lights.rimLight.intensity - target.rim) < snap
    ) {
      this.lights.keyLight.intensity = target.key;
      this.lights.fillLight.intensity = target.fill;
      this.lights.ambient.intensity = target.ambient;
      this.lights.rimLight.intensity = target.rim;
      this.lights.keyLight.castShadow = target.castShadow;
      this.lights.keyLight.shadow.radius = target.shadowRadius;
      this.ultraLightTarget = null;
    } else {
      this.lights.keyLight.castShadow = target.castShadow;
    }
  }
}
