import { describe, expect, it } from "vitest";
import {
  CAPTURE_SHOWCASE_BLOOM,
  MAX_EXPORT_EDGE,
  MAX_EXPORT_PIXELS,
  PHOTO_CAPTURE_LIGHT,
  VIEWER_RENDER_SIZE_MAP,
  clampExportDimension,
  resolveExportRenderSize,
  resolveSupersampleScale,
} from "./renderExportQuality";

describe("renderExportQuality", () => {
  it("mapeia large para Full HD e 4k para UHD", () => {
    expect(VIEWER_RENDER_SIZE_MAP.large).toEqual([1920, 1080]);
    expect(VIEWER_RENDER_SIZE_MAP["4k"]).toEqual([3840, 2160]);
  });

  it("Alta/realismo usa 2× em Full HD e não ultrapassa 4K", () => {
    expect(resolveSupersampleScale(1920, 1080, true)).toBe(2);
    expect(resolveSupersampleScale(3840, 2160, true)).toBe(1);
    expect(resolveSupersampleScale(1920, 1080, false)).toBe(1);
    const large = resolveExportRenderSize(1920, 1080, true);
    expect(large.renderWidth * large.renderHeight).toBeLessThanOrEqual(MAX_EXPORT_PIXELS);
    expect(large.renderWidth).toBe(3840);
    expect(large.renderHeight).toBe(2160);
  });

  it("limita dimensões inválidas", () => {
    expect(clampExportDimension(0, 1920)).toBe(1920);
    expect(clampExportDimension(8000, 1920)).toBe(MAX_EXPORT_EDGE);
    expect(clampExportDimension(1280, 1920)).toBe(1280);
  });

  it("bloom de captura é mais contido que o histórico 0.16/0.18", () => {
    expect(CAPTURE_SHOWCASE_BLOOM.strength).toBeLessThan(0.16);
    expect(CAPTURE_SHOWCASE_BLOOM.threshold).toBeGreaterThan(0.88);
    expect(PHOTO_CAPTURE_LIGHT.exposure).toBeGreaterThan(1.22);
  });
});
