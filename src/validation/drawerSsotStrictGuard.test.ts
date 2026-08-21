/**
 * Strict SSOT — falha o build se 18,5 / 22,5 / 41 / floorTop / Progressivas / Viewer rev
 * forem alterados manualmente.
 */
import { describe, expect, it } from "vitest";
import {
  assertGavIndustrialSsotOrThrow,
  assertGavViewerSsotOrThrow,
  DRAWER_GAV1_MODULE_GUIDE_AXIS_MM,
  DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM,
  DRAWER_LOWEST_BODY_ELEVATION_FROM_FRONT_MM,
  DRAWER_PROGRESSIVAS_H800_T19_GUIDE_FROM_FLOOR_TOP_MM,
  DRAWER_SLIDE_AXIS_FROM_DRAWER_SIDE_BOTTOM_MM,
  DRAWER_VIEWER_SSOT_LAYOUT_REV,
  generateDrawerGroup,
  drawerGroupToLayerItems,
  resolveModuleFloorTopYMm,
} from "../core/drawers";
import { getDrawerViewerLayoutRev } from "../3d/objects/DrawerFactory";
import { isDrawerViewerBodyVerticalFlipActiveForElevationMm } from "../3d/objects/drawerVisualBodyFlip";
import {
  resolveEuropeanModuleRunnerLinesYMm,
} from "../core/drawers/drilling/DrawerDrillingRules";
import { settingsDefaults } from "../core/settings/settingsSchema";

describe("Strict SSOT gavetas — build guard", () => {
  it("constantes industriais imutáveis 18,5 / 22,5 / 41 / floorTop", () => {
    expect(() => assertGavIndustrialSsotOrThrow()).not.toThrow();
    expect(DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM).toBe(18.5);
    expect(DRAWER_SLIDE_AXIS_FROM_DRAWER_SIDE_BOTTOM_MM).toBe(22.5);
    expect(DRAWER_GAV1_MODULE_GUIDE_AXIS_MM).toBe(41);
    expect(DRAWER_LOWEST_BODY_ELEVATION_FROM_FRONT_MM).toBe(16.5);
    expect(resolveModuleFloorTopYMm(800, 19)).toBe(-381);
    expect(() => resolveModuleFloorTopYMm(800, 0)).toThrow(/floorThicknessMm/);
  });

  it("Viewer rev floor-top-v5 + GAV_1 sem flip", () => {
    expect(DRAWER_VIEWER_SSOT_LAYOUT_REV).toBe("drawer-body-ssot-floor-top-v5");
    expect(getDrawerViewerLayoutRev()).toBe("drawer-body-ssot-floor-top-v5");
    expect(() => assertGavViewerSsotOrThrow(getDrawerViewerLayoutRev())).not.toThrow();
    expect(isDrawerViewerBodyVerticalFlipActiveForElevationMm(16.5)).toBe(false);
    expect(isDrawerViewerBodyVerticalFlipActiveForElevationMm(18.5)).toBe(false);
    expect(isDrawerViewerBodyVerticalFlipActiveForElevationMm(48)).toBe(true);
  });

  it("Progressivas H=800 T=19 — guias [41, 377.3, 682.1] desde floorTop", () => {
    const H = 800;
    const T = 19;
    const panelH = H - 2 * T;
    const group = generateDrawerGroup({
      boxWidth: 600,
      boxHeight: H,
      boxDepth: 560,
      boxThickness: T,
      boxId: "ssot-strict-prog",
      drawerCount: 3,
      drawerType: "normal",
      heightMode: "top_small_mid_medium_bottom_large",
      availableDepths: settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      drawerSettings: settingsDefaults.gavetas,
      espessuraCostaMm: 10,
      costaAtiva: true,
    });
    const layers = drawerGroupToLayerItems(group);
    const fromTop = resolveEuropeanModuleRunnerLinesYMm({
      panelHeightMm: panelH,
      boxInternalHeightMm: H,
      boxExternalHeightMm: H,
      floorThicknessMm: T,
      heightMode: "top_small_mid_medium_bottom_large",
      drawers: layers.map((d) => ({
        posYMm: d.posY!,
        frontHeightMm: d.height!,
        sideBaseElevationMm: d.metadata?.sideBaseElevationMm as number,
      })),
    });
    const yGuia = fromTop.map((y) => panelH - y);
    const expected = DRAWER_PROGRESSIVAS_H800_T19_GUIDE_FROM_FLOOR_TOP_MM;
    expect(yGuia[0]).toBeCloseTo(expected[0], 5);
    expect(yGuia[1]).toBeCloseTo(expected[1], 5);
    expect(yGuia[2]).toBeCloseTo(expected[2], 5);
    expect(yGuia[0]).toBeCloseTo(41, 5);
  });
});
