import { describe, expect, it, vi } from "vitest";
import {
  LightingEngine,
  clampGlobalLightIntensity,
} from "../../../src/3d/viewer-engine/lighting/LightingEngine";
import type { Lights } from "../../../src/3d/viewer-engine/lighting/Lights";

describe("LightingEngine (Z-01.2.8 A)", () => {
  it("aplica intensidade global com clamp 0.6–1.4 nos presets de luz", () => {
    const lights = {
      ambient: { intensity: 0.4 },
      hemisphere: { intensity: 0.3 },
      keyLight: { intensity: 1, shadow: { intensity: 1, radius: 6 }, castShadow: true },
      fillLight: { intensity: 0.5 },
      rimLight: { intensity: 0.2 },
    } as unknown as Lights;
    const engine = new LightingEngine(lights, {
      ambient: 0.4,
      hemisphere: 0.3,
      key: 1,
      fill: 0.5,
      rim: 0.2,
    });

    expect(engine.applyGlobalIntensity(3, false)).toBe(1.4);
    expect(lights.keyLight.intensity).toBeCloseTo(1.4);
    expect(clampGlobalLightIntensity(0)).toBe(0.6);
    expect(engine.applyShadowIntensity(2)).toBe(1);
  });

  it("não chama o renderer ao ajustar intensidade", () => {
    const renderer = { render: vi.fn() };
    const engine = new LightingEngine(
      {
        ambient: { intensity: 0.4 },
        hemisphere: { intensity: 0.3 },
        keyLight: { intensity: 1, shadow: { intensity: 1, radius: 6 }, castShadow: true },
        fillLight: { intensity: 0.5 },
        rimLight: { intensity: 0.2 },
      } as never,
      { ambient: 0.4, hemisphere: 0.3, key: 1, fill: 0.5, rim: 0.2 }
    );
    engine.applyGlobalIntensity(1, false);
    expect(renderer.render).not.toHaveBeenCalled();
  });
});
