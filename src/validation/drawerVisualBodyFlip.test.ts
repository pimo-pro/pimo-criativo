import { describe, expect, it } from "vitest";
import {
  DRAWER_VIEWER_BODY_VERTICAL_FLIP,
  resolveDrawerVisualBaseElevationMm,
  resolveDrawerVisualBodyCenterOffsetYMm,
} from "../3d/objects/drawerVisualBodyFlip";
import { DRAWER_BODY_ELEVATION_FROM_FRONT_MM } from "../core/drawers/drawerGeometryConstants";

describe("drawerVisualBodyFlip — Viewer only", () => {
  const industrialElev = DRAWER_BODY_ELEVATION_FROM_FRONT_MM; // 48
  const frontH = 200;
  const bodyH = 200 - 68.5; // middle delta
  const delta = frontH - bodyH; // 68.5

  it("flag de flip visual activa (removível na revisão industrial)", () => {
    expect(DRAWER_VIEWER_BODY_VERTICAL_FLIP).toBe(true);
  });

  it("elevação visual na base = folga industrial do topo (~20,5)", () => {
    const visualElev = resolveDrawerVisualBaseElevationMm(
      frontH,
      bodyH,
      industrialElev
    );
    expect(visualElev).toBeCloseTo(delta - industrialElev, 5);
    expect(visualElev).toBeCloseTo(20.5, 5);
    expect(visualElev).toBeLessThan(industrialElev);
  });

  it("centro do corpo: desnível grande (48) no topo, pequeno na base", () => {
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
