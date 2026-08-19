import { describe, expect, it, vi } from "vitest";
import {
  applyDisplayQualityPresetToViewer,
  buildDisplayQualitySettingsPatch,
  resolveDisplayQualityLevel,
  shouldEnableShowcaseForQualitySettings,
  type DisplayQualityViewerApi,
} from "../../src/components/layout/topbar/displayQualityPresets";

describe("displayQualityPresets (Z-02.4)", () => {
  it("Baixa desliga efeitos, reflexos e Ultra", () => {
    const patch = buildDisplayQualitySettingsPatch("baixa");
    expect(patch.materialQuality).toBe("standard");
    expect(patch.enableReflections).toBe(false);
    expect(patch.ultraPerformanceModeOptions).toEqual({ enabled: false, mode: "balanced" });
    expect(shouldEnableShowcaseForQualitySettings(patch)).toBe(false);
    expect(resolveDisplayQualityLevel(patch)).toBe("baixa");
  });

  it("Média liga bloom (showcase) sem reflexos", () => {
    const patch = buildDisplayQualitySettingsPatch("media");
    expect(patch.materialQuality).toBe("premium");
    expect(patch.enableReflections).toBe(false);
    expect(patch.ultraPerformanceModeOptions.enabled).toBe(false);
    expect(shouldEnableShowcaseForQualitySettings(patch)).toBe(true);
    expect(resolveDisplayQualityLevel(patch)).toBe("media");
  });

  it("Alta liga bloom e reflexos sem Ultra, sem clarear a luz global", () => {
    const patch = buildDisplayQualitySettingsPatch("alta");
    expect(patch.materialQuality).toBe("premium");
    expect(patch.enableReflections).toBe(true);
    expect(patch.globalLightIntensity).toBe(1.0);
    expect(patch.ultraPerformanceModeOptions.enabled).toBe(false);
    expect(shouldEnableShowcaseForQualitySettings(patch)).toBe(true);
    expect(resolveDisplayQualityLevel(patch)).toBe("alta");
  });

  it("aplica o preset no viewer sem Ultra", () => {
    const viewerApi: DisplayQualityViewerApi = {
      setUltraPerformanceModeOptions: vi.fn(),
      setUltraPerformanceMode: vi.fn(),
      setMaterialQuality: vi.fn(),
      setReflectionsEnabled: vi.fn(),
      setShowcaseMode: vi.fn(),
      setGlobalLightIntensity: vi.fn(),
      setShadowIntensity: vi.fn(),
      setGlossIntensity: vi.fn(),
      setMatteMode: vi.fn(),
    };

    applyDisplayQualityPresetToViewer(viewerApi, "alta");

    expect(viewerApi.setUltraPerformanceMode).toHaveBeenCalledWith(false);
    expect(viewerApi.setReflectionsEnabled).toHaveBeenCalledWith(true);
    expect(viewerApi.setShowcaseMode).toHaveBeenCalledWith(true, false);
    expect(viewerApi.setMaterialQuality).toHaveBeenCalledWith("premium");
    expect(viewerApi.setGlobalLightIntensity).toHaveBeenCalledWith(1.0);
  });
});
