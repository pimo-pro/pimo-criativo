/**
 * Stack din?mico anti-sobreposi??o ? alturas/bottoms/slides a partir de H real.
 * Laterais unificadas h?64,5; elev 18,5 / 17 / 12,5.
 */
import { describe, expect, it } from "vitest";
import {
  calculateDrawerHeights,
  calculateDrawerPositions,
  generateDrawerGroup,
  drawerGroupToLayerItems,
  resolveDrawerFrontStackGeometry,
  DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM,
  DRAWER_HIGHEST_BODY_ELEVATION_FROM_FRONT_MM,
  DRAWER_FRONT_LATERAL_GAP_MM,
} from "../core/drawers";
import { DRAWER_VERTICAL_GAP_MM } from "../core/drawers/drawerGeometryConstants";
import {
  assertNoDrawerFrontOverlap,
  assertTopFrontCoversCimaWithClearance,
  resolveDynamicEqualDrawerStackLayout,
  resolveDrawerWoodBodyHeightForStackRoleMm,
} from "../core/drawers/drawerSolidWorksStackGeometry";
import { DRAWER_SLIDE_OFFSET_FROM_BOTTOM_MM } from "../core/drawers/drilling/drawerDowelInterlock";
import { resolveEuropeanModuleRunnerLinesYMm } from "../core/drawers/drilling/DrawerDrillingRules";
import { settingsDefaults } from "../core/settings/settingsSchema";

describe("stack din?mico anti-sobreposi??o", () => {
  const H = 762;
  const T = 19;

  it("f?rmula equal: zero overlap, gaps 4, slides = bottom+41", () => {
    const layout = resolveDynamicEqualDrawerStackLayout({
      count: 3,
      boxHeightMm: H,
      slideOffsetFromBottomMm: DRAWER_SLIDE_OFFSET_FROM_BOTTOM_MM,
    });
    expect(layout.heights[0]).toBeCloseTo(251.333, 3);
    expect(layout.bottoms[0]).toBeCloseTo(0, 5);
    expect(layout.bottoms[1]).toBeCloseTo(255.333, 3);
    expect(layout.bottoms[2]).toBeCloseTo(510.667, 3);
    expect(layout.tops[2]).toBeCloseTo(H, 3);
    expect(layout.slides[0]).toBeCloseTo(41, 3);
    expect(layout.slides[1]).toBeCloseTo(296.333, 3);
    expect(layout.slides[2]).toBeCloseTo(551.667, 3);

    const anti = assertNoDrawerFrontOverlap({
      bottoms: layout.bottoms,
      tops: layout.tops,
      minGapMm: DRAWER_VERTICAL_GAP_MM,
    });
    expect(anti.ok).toBe(true);
    expect(anti.gapsMm.every((g) => Math.abs(g - 4) < 0.01)).toBe(true);
    expect(anti.overlapsMm.every((o) => o === 0)).toBe(true);

    const cover = assertTopFrontCoversCimaWithClearance({
      boxExternalHeightMm: H,
      topPanelThicknessMm: T,
      frontTopMm: layout.tops[2]!,
      frontBottomMm: layout.bottoms[2]!,
    });
    expect(cover.ok).toBe(true);
  });

  it("laterais GAV_1 frente×0,685; mid/high ×0,75; elev 16,5 / 17", () => {
    expect(DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM).toBe(16.5);
    expect(DRAWER_HIGHEST_BODY_ELEVATION_FROM_FRONT_MM).toBe(12.5);
    expect(DRAWER_FRONT_LATERAL_GAP_MM).toBe(2);
    expect(settingsDefaults.gavetas.gavetaFolgaFrenteMm).toBe(2);

    const h = 251.33333333333334;
    expect(resolveDrawerWoodBodyHeightForStackRoleMm(h, "lowest")).toBeCloseTo(h * 0.685, 3);
    expect(resolveDrawerWoodBodyHeightForStackRoleMm(h, "middle")).toBeCloseTo(h * 0.75, 3);
    expect(resolveDrawerWoodBodyHeightForStackRoleMm(h, "highest")).toBeCloseTo(h * 0.75, 3);
  });

  it("generateDrawerGroup 3 gavetas — GAV_1 elev 16,5 / R 0,685; mid/high 17 / 0,75", () => {
    const group = generateDrawerGroup({
      boxWidth: 600,
      boxHeight: H,
      boxDepth: 500,
      boxThickness: T,
      boxId: "dyn-3",
      drawerCount: 3,
      drawerType: "normal",
      heightMode: "equal",
      availableDepths: settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      drawerSettings: settingsDefaults.gavetas,
      espessuraCostaMm: 10,
      costaAtiva: true,
    });
    const layers = drawerGroupToLayerItems(group);
    const heights = layers.map((l) => l.height!);
    const positions = layers.map((l) => l.posY!);
    const bottoms = heights.map((h, i) => positions[i]! - (-H / 2) - h / 2);
    const tops = bottoms.map((b, i) => b + heights[i]!);

    const anti = assertNoDrawerFrontOverlap({ bottoms, tops });
    expect(anti.ok).toBe(true);

    expect(layers[0]!.metadata?.sideBaseElevationMm).toBe(16.5);
    expect(layers[1]!.metadata?.sideBaseElevationMm).toBe(17);
    expect(layers[2]!.metadata?.sideBaseElevationMm).toBe(17);
    expect(layers[0]!.bodyHeight).toBeCloseTo(heights[0]! * 0.685, 5);
    expect(layers[1]!.bodyHeight).toBeCloseTo(heights[1]! * 0.75, 5);
    expect(layers[2]!.bodyHeight).toBeCloseTo(heights[2]! * 0.75, 5);
    expect(heights[0]).toBeCloseTo(heights[1]!, 5);
    expect(heights[1]).toBeCloseTo(heights[2]!, 5);

    const moduleBase = -H / 2;
    const bodyH = layers[0]!.bodyHeight!;
    const offsetY = layers[0]!.bodyCenterOffsetY!;
    const bodyBottom = layers[0]!.posY! + offsetY - bodyH / 2;
    expect(bodyBottom - moduleBase).toBeCloseTo(2 + 16.5, 5);

    const bodyH2 = layers[2]!.bodyHeight!;
    const offsetY2 = layers[2]!.bodyCenterOffsetY!;
    const bodyTop2 = layers[2]!.posY! + offsetY2 + bodyH2 / 2;
    const cimaUnderside = moduleBase + H - T;
    // folga CIMA = frontH×(1−ratio) − elevação − T (ratio Admin 0,75; elev highest 17)
    const frontHTop = heights[2]!;
    const expectedCimaClearance =
      frontHTop * (settingsDefaults.gavetas.gavetaReducaoPercentual / 100) - 17 - T;
    expect(cimaUnderside - bodyTop2).toBeCloseTo(expectedCimaClearance, 1);

    const geo2 = resolveDrawerFrontStackGeometry({
      drawerIndex0Based: 2,
      drawerHeights: heights,
      boxInternalHeightMm: H,
      posYMm: positions[2]!,
    });
    expect(geo2.flushToModuleTop).toBe(true);

    const runnerFromTop = resolveEuropeanModuleRunnerLinesYMm({
      panelHeightMm: H - 2 * T,
      boxInternalHeightMm: H,
      drawers: positions.map((posY, i) => ({
        posYMm: posY,
        frontHeightMm: heights[i]!,
      })),
    });
    const panelH = H - 2 * T;
    const fromBottom = runnerFromTop.map((yTop) => panelH - yTop);
    expect(fromBottom[0]).toBeCloseTo(41, 3);
    // middle/highest: eixo 22,5 desde base da frente; B0=2 → fromBottom = (bottom−2)+22,5
    expect(fromBottom[1]).toBeCloseTo(277.167, 3);
    expect(fromBottom[2]).toBeCloseTo(531.833, 3);
  });

  it("calculateDrawerHeights equal clássico com B0=2", () => {
    const heights = calculateDrawerHeights(3, H, "equal", undefined, {
      topPanelThicknessMm: T,
    });
    // h = (H − 2 − 4×2) / 3 = 752/3
    expect(heights[0]).toBeCloseTo(250.667, 3);
    expect(heights[0]).toBeCloseTo(heights[1]!, 5);
    const positions = calculateDrawerPositions(heights, H);
    const b0 = positions[0]! - (-H / 2) - heights[0]! / 2;
    const b1 = positions[1]! - (-H / 2) - heights[1]! / 2;
    expect(b0).toBeCloseTo(2, 5);
    expect(b1 - (b0 + heights[0]!)).toBeCloseTo(4, 5);
  });
});
