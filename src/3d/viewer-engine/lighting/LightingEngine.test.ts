import { describe, expect, it } from "vitest";
import {
  clampGlobalLightIntensity,
  clampShadowIntensity,
  scaleLightProfile,
} from "./LightingEngine";

describe("LightingEngine (Z-01.2.7)", () => {
  it("limita a intensidade global a 0.6–1.4", () => {
    expect(clampGlobalLightIntensity(0)).toBe(0.6);
    expect(clampGlobalLightIntensity(3)).toBe(1.4);
    expect(clampGlobalLightIntensity(1)).toBe(1);
    expect(clampGlobalLightIntensity(Number.NaN)).toBe(1);
  });

  it("limita a intensidade de sombra a 0–1", () => {
    expect(clampShadowIntensity(-1)).toBe(0);
    expect(clampShadowIntensity(2)).toBe(1);
    expect(clampShadowIntensity(0.4)).toBe(0.4);
  });

  it("escala o perfil de luz sem alterar sombras", () => {
    const scaled = scaleLightProfile(
      { key: 1, fill: 0.5, ambient: 0.4, rim: 0.2, castShadow: true, shadowRadius: 6 },
      1.1
    );
    expect(scaled.key).toBeCloseTo(1.1);
    expect(scaled.castShadow).toBe(true);
    expect(scaled.shadowRadius).toBe(6);
  });
});
