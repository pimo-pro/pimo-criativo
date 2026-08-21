import { describe, expect, it } from "vitest";
import {
  DRAWER_VIEWER_BODY_VERTICAL_FLIP,
  isDrawerViewerBodyVerticalFlipActiveForElevationMm,
  resolveDrawerVisualBaseElevationMm,
  resolveDrawerVisualBodyCenterOffsetYMm,
} from "../3d/objects/drawerVisualBodyFlip";
import {
  DRAWER_BODY_ELEVATION_FROM_FRONT_MM,
  DRAWER_LOWEST_BODY_ELEVATION_FROM_FRONT_MM,
} from "../core/drawers/drawerGeometryConstants";

describe("drawerVisualBodyFlip — Viewer only", () => {
  const industrialElev = DRAWER_BODY_ELEVATION_FROM_FRONT_MM; // 48
  const frontH = 200;
  const bodyH = 200 - 68.5; // middle delta
  const delta = frontH - bodyH; // 68.5

  it("flag de flip visual activa (removível na revisão industrial)", () => {
    expect(DRAWER_VIEWER_BODY_VERTICAL_FLIP).toBe(true);
  });

  it("flip activo para elevação middle/highest (48); inactivo para GAV_1 (16,5)", () => {
    expect(isDrawerViewerBodyVerticalFlipActiveForElevationMm(48)).toBe(true);
    expect(isDrawerViewerBodyVerticalFlipActiveForElevationMm(16.5)).toBe(false);
    expect(
      isDrawerViewerBodyVerticalFlipActiveForElevationMm(
        DRAWER_LOWEST_BODY_ELEVATION_FROM_FRONT_MM
      )
    ).toBe(false);
  });

  it("elevação visual na base = folga industrial do topo (~20,5) — middle", () => {
    const visualElev = resolveDrawerVisualBaseElevationMm(
      frontH,
      bodyH,
      industrialElev
    );
    expect(visualElev).toBeCloseTo(delta - industrialElev, 5);
    expect(visualElev).toBeCloseTo(20.5, 5);
    expect(visualElev).toBeLessThan(industrialElev);
  });

  it("GAV_1 / single: sem flip — elevação visual = industrial 16,5", () => {
    const elevLowest = DRAWER_LOWEST_BODY_ELEVATION_FROM_FRONT_MM;
    const bodyHLowest = frontH - 85.5;
    const visualElev = resolveDrawerVisualBaseElevationMm(
      frontH,
      bodyHLowest,
      elevLowest
    );
    expect(visualElev).toBeCloseTo(elevLowest, 5);
    expect(visualElev).toBeCloseTo(16.5, 5);
  });

  it("elevação não finita — nunca 0; fallback SSOT 16,5", () => {
    expect(resolveDrawerVisualBaseElevationMm(200, 100, Number.NaN)).toBe(16.5);
    expect(resolveDrawerVisualBaseElevationMm(200, 100, Number.NaN)).not.toBe(0);
  });

  it("centro do corpo: desnível grande (48) no topo, pequeno na base — middle", () => {
    const cy = resolveDrawerVisualBodyCenterOffsetYMm(
      frontH,
      bodyH,
      industrialElev
    );
    const bodyBase = cy - bodyH / 2;
    const bodyTop = cy + bodyH / 2;
    const frontBase = -frontH / 2;
    const frontTop = frontH / 2;
    const elevBottom = bodyBase - frontBase;
    const clearTop = frontTop - bodyTop;
    expect(elevBottom).toBeCloseTo(20.5, 5);
    expect(clearTop).toBeCloseTo(48, 5);
  });
});
