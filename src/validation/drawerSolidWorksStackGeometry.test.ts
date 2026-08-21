/**
 * Stack dinâmico anti-sobreposição — equal_quase com B0=2.
 * B0=2 · G=4 · ajuste 1.ª = −2 · corpo Diff 2 · runners Diff 1.
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

describe("stack dinâmico anti-sobreposição", () => {
  const H = 762;
  const T = 19;
  const B0 = 2;

  it("fórmula equal_quase: zero overlap, gaps 4, slides = bottom+41", () => {
    // distributable = 762 − 2 − 8 = 752; hEqual = (752−(−2))/3 = 251.333…
    // frente0 = 249.333; frente1/2 = 251.333
    const layout = resolveDynamicEqualDrawerStackLayout({
      count: 3,
      boxHeightMm: H,
      slideOffsetFromBottomMm: DRAWER_SLIDE_OFFSET_FROM_BOTTOM_MM,
    });
    expect(layout.heights[0]).toBeCloseTo(249.3333333, 5);
    expect(layout.heights[1]).toBeCloseTo(251.3333333, 5);
    expect(layout.heights[2]).toBeCloseTo(251.3333333, 5);
    expect(layout.bottoms[0]).toBeCloseTo(B0, 5);
    expect(layout.bottoms[1]).toBeCloseTo(B0 + 249.3333333 + 4, 5);
    expect(layout.bottoms[2]).toBeCloseTo(B0 + 249.3333333 + 4 + 251.3333333 + 4, 5);
    expect(layout.tops[2]).toBeCloseTo(H, 3);
    expect(layout.slides[0]).toBeCloseTo(B0 + 41, 3);
    expect(layout.slides[1]).toBeCloseTo(layout.bottoms[1]! + 41, 3);
    expect(layout.slides[2]).toBeCloseTo(layout.bottoms[2]! + 41, 3);

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

  it("laterais industriais frente−delta; bodyBottom GAV_1 = 18,5", () => {
    expect(DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM).toBe(18.5);
    expect(DRAWER_HIGHEST_BODY_ELEVATION_FROM_FRONT_MM).toBe(12.5); // legado
    expect(DRAWER_FRONT_LATERAL_GAP_MM).toBe(2);
    expect(settingsDefaults.gavetas.gavetaFolgaFrenteMm).toBe(2);

    const h = 252;
    expect(resolveDrawerWoodBodyHeightForStackRoleMm(h, "lowest")).toBeCloseTo(h - 85.5, 3);
    expect(resolveDrawerWoodBodyHeightForStackRoleMm(h, "middle")).toBeCloseTo(h - 68.5, 3);
    expect(resolveDrawerWoodBodyHeightForStackRoleMm(h, "highest")).toBeCloseTo(h - 68.5, 3);
  });

  it("generateDrawerGroup 3 gavetas — equal_quase exterior; elev lowest 16,5 / upper 48", () => {
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
    const exteriorBase = -H / 2;
    const bottoms = heights.map((h, i) => positions[i]! - exteriorBase - h / 2);
    const tops = bottoms.map((b, i) => b + heights[i]!);

    const anti = assertNoDrawerFrontOverlap({ bottoms, tops });
    expect(anti.ok).toBe(true);

    // Exterior H−B0: usable=760 → equal_quase 249,333 / 251,333 / 251,333
    expect(heights[0]).toBeCloseTo(249.3333333, 5);
    expect(heights[1]).toBeCloseTo(251.3333333, 5);
    expect(heights[2]).toBeCloseTo(251.3333333, 5);
    expect(heights[0]).toBeLessThan(heights[1]!);
    expect(heights[1]).toBeCloseTo(heights[2]!, 5);

    expect(layers[0]!.metadata?.sideBaseElevationMm).toBeCloseTo(16.5 + T, 5);
    expect(layers[1]!.metadata?.sideBaseElevationMm).toBe(48);
    expect(layers[2]!.metadata?.sideBaseElevationMm).toBe(48);
    expect(layers[0]!.bodyHeight).toBeCloseTo(heights[0]! - 85.5, 5);
    expect(layers[1]!.bodyHeight).toBeCloseTo(heights[1]! - 68.5, 5);
    expect(layers[2]!.bodyHeight).toBeCloseTo(heights[2]! - 68.5, 5);
    expect(layers[1]!.bodyHeight).toBeCloseTo(layers[2]!.bodyHeight!, 5);

    const floorTop = -H / 2 + T;
    const bodyH = layers[0]!.bodyHeight!;
    const offsetY = layers[0]!.bodyCenterOffsetY!;
    const bodyBottom = layers[0]!.posY! + offsetY - bodyH / 2;
    expect(bodyBottom - floorTop).toBeCloseTo(18.5, 5);
    expect(bottoms[0]).toBeCloseTo(B0, 5);
    expect(tops[2]).toBeCloseTo(H, 3);

    const geo2 = resolveDrawerFrontStackGeometry({
      drawerIndex0Based: 2,
      drawerHeights: heights,
      boxInternalHeightMm: H,
      posYMm: positions[2]!,
    });
    expect(geo2.flushToModuleTop).toBe(true);

    const cover = assertTopFrontCoversCimaWithClearance({
      boxExternalHeightMm: H,
      topPanelThicknessMm: T,
      frontTopMm: tops[2]!,
      frontBottomMm: bottoms[2]!,
    });
    expect(cover.ok).toBe(true);

    const runnerFromTop = resolveEuropeanModuleRunnerLinesYMm({
      panelHeightMm: H - 2 * T,
      boxInternalHeightMm: H,
      boxExternalHeightMm: H,
      floorThicknessMm: T,
      drawers: positions.map((posY, i) => ({
        posYMm: posY,
        frontHeightMm: heights[i]!,
      })),
    });
    const panelH = H - 2 * T;
    const fromBottom = runnerFromTop.map((yTop) => panelH - yTop);
    // Diff 1 pitch H/n — independente do stack das frentes
    expect(fromBottom[0]).toBeCloseTo(41, 3);
    expect(fromBottom[1]).toBeCloseTo(276, 3);
    expect(fromBottom[2]).toBeCloseTo(530, 3);
  });

  it("calculateDrawerHeights equal_quase com B0=2 (vão interior H−2T — modo GPS)", () => {
    const heights = calculateDrawerHeights(3, H, "equal", undefined, {
      topPanelThicknessMm: T,
    });
    expect(heights[0]).toBeCloseTo(236.6666667, 5);
    expect(heights[1]).toBeCloseTo(238.6666667, 5);
    expect(heights[2]).toBeCloseTo(238.6666667, 5);
    const positions = calculateDrawerPositions(heights, H, B0, {
      floorThicknessMm: T,
      topPanelThicknessMm: T,
    });
    const floorTop = -H / 2 + T;
    const b0 = positions[0]! - floorTop - heights[0]! / 2;
    const b1 = positions[1]! - floorTop - heights[1]! / 2;
    expect(b0).toBeCloseTo(B0, 5);
    expect(b1 - (b0 + heights[0]!)).toBeCloseTo(4, 5);
  });
});
