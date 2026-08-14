/**
 * Diff 3 — stack das frentes (equal_quase) + integração Diff 1 / Diff 2.
 * Módulo gavita 8: H=800, n=3, B0=0, G=4, ajuste 1.ª = −2.
 */
import { describe, expect, it } from "vitest";
import {
  calculateDrawerHeights,
  calculateDrawerPositions,
  generateDrawerGroup,
  drawerGroupToLayerItems,
  DRAWER_STACK_BASE_OFFSET_MM,
  DRAWER_STACK_GAVETA1_ADJUST_MM,
  DRAWER_VERTICAL_BASE_OFFSET_MM,
  DRAWER_VERTICAL_GAP_MM,
  DRAWER_BODY_DELTA_LOWEST_MM,
  DRAWER_BODY_DELTA_UPPER_MM,
  DRAWER_COSTA_HEIGHT_BELOW_LATERAL_MM,
  resolveDrawerFrontStackGeometry,
} from "../core/drawers";
import { resolveDynamicEqualDrawerStackLayout } from "../core/drawers/drawerSolidWorksStackGeometry";
import {
  resolvePitchRunnerLinesFromBottomMm,
  resolveEuropeanModuleRunnerLinesYMm,
} from "../core/drawers/drilling/DrawerDrillingRules";
import { settingsDefaults } from "../core/settings/settingsSchema";

describe("Diff 3 — stack frentes gavita 8", () => {
  const H = 800;
  const T = 19;
  const n = 3;

  it("constantes B0=0, G=4, ajuste=−2", () => {
    expect(DRAWER_STACK_BASE_OFFSET_MM).toBe(0);
    expect(DRAWER_VERTICAL_BASE_OFFSET_MM).toBe(0);
    expect(DRAWER_VERTICAL_GAP_MM).toBe(4);
    expect(DRAWER_STACK_GAVETA1_ADJUST_MM).toBe(-2);
  });

  it("frentes equal_quase: 262,67 / 264,67 / 264,67", () => {
    const heights = calculateDrawerHeights(n, H, "equal");
    expect(heights[0]).toBeCloseTo(262.6666667, 5);
    expect(heights[1]).toBeCloseTo(264.6666667, 5);
    expect(heights[2]).toBeCloseTo(264.6666667, 5);
    expect(heights[1]).toBeCloseTo(heights[2]!, 10);

    const layout = resolveDynamicEqualDrawerStackLayout({
      count: n,
      boxHeightMm: H,
    });
    expect(layout.heights[0]).toBeCloseTo(heights[0]!, 10);
    expect(layout.heights[1]).toBeCloseTo(heights[1]!, 10);
    expect(layout.heights[2]).toBeCloseTo(heights[2]!, 10);
    expect(layout.bottoms[0]).toBeCloseTo(0, 5);
    expect(layout.bottoms[1]).toBeCloseTo(266.6666667, 5);
    expect(layout.bottoms[2]).toBeCloseTo(535.3333333, 5);
    expect(layout.tops[2]).toBeCloseTo(H, 5);
  });

  it("posições Y — B0=0 e gaps 4", () => {
    const heights = calculateDrawerHeights(n, H, "equal");
    const positions = calculateDrawerPositions(heights, H);
    for (let i = 0; i < n; i++) {
      const geo = resolveDrawerFrontStackGeometry({
        drawerIndex0Based: i,
        drawerHeights: heights,
        boxInternalHeightMm: H,
        posYMm: positions[i]!,
      });
      if (i === 0) {
        expect(geo.frontBottomFromModuleBaseMm).toBeCloseTo(0, 5);
        expect(geo.flushToModuleBase).toBe(true);
      }
      if (i === n - 1) {
        expect(geo.frontTopFromModuleBaseMm).toBeCloseTo(H, 5);
        expect(geo.flushToModuleTop).toBe(true);
      }
    }
    const b0 = positions[0]! - (-H / 2) - heights[0]! / 2;
    const b1 = positions[1]! - (-H / 2) - heights[1]! / 2;
    expect(b0).toBeCloseTo(0, 5);
    expect(b1 - (b0 + heights[0]!)).toBeCloseTo(4, 5);
  });

  it("integração Diff 2 — laterais/costas/elev; Diff 1 — Y corrediças", () => {
    const group = generateDrawerGroup({
      boxWidth: 600,
      boxHeight: H,
      boxDepth: 500,
      boxThickness: T,
      boxId: "gavita8-stack",
      drawerCount: n,
      drawerType: "normal",
      heightMode: "equal",
      availableDepths: settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      drawerSettings: settingsDefaults.gavetas,
      espessuraCostaMm: 10,
      costaAtiva: true,
    });
    const layers = drawerGroupToLayerItems(group);
    const heights = layers.map((l) => l.height!);

    expect(heights[0]).toBeCloseTo(262.6666667, 5);
    expect(heights[1]).toBeCloseTo(264.6666667, 5);
    expect(heights[2]).toBeCloseTo(264.6666667, 5);

    expect(layers[0]!.bodyHeight).toBeCloseTo(177.1666667, 5);
    expect(layers[1]!.bodyHeight).toBeCloseTo(196.1666667, 5);
    expect(layers[2]!.bodyHeight).toBeCloseTo(196.1666667, 5);
    expect(layers[0]!.bodyHeight).toBeCloseTo(heights[0]! - DRAWER_BODY_DELTA_LOWEST_MM, 5);
    expect(layers[1]!.bodyHeight).toBeCloseTo(heights[1]! - DRAWER_BODY_DELTA_UPPER_MM, 5);

    expect(layers[0]!.backHeight).toBeCloseTo(154.1666667, 5);
    expect(layers[1]!.backHeight).toBeCloseTo(173.1666667, 5);
    expect(layers[2]!.backHeight).toBeCloseTo(173.1666667, 5);
    expect(layers[0]!.backHeight).toBeCloseTo(
      layers[0]!.bodyHeight! - DRAWER_COSTA_HEIGHT_BELOW_LATERAL_MM,
      5
    );

    expect(layers[0]!.metadata?.sideBaseElevationMm).toBe(48);
    expect(layers[1]!.metadata?.sideBaseElevationMm).toBe(48);
    expect(layers[2]!.metadata?.sideBaseElevationMm).toBe(48);

    const moduleBase = -H / 2;
    const bodyH = layers[0]!.bodyHeight!;
    const offsetY = layers[0]!.bodyCenterOffsetY!;
    const bodyBottom = layers[0]!.posY! + offsetY - bodyH / 2;
    expect(bodyBottom - moduleBase).toBeCloseTo(48, 5);

    const pitch = resolvePitchRunnerLinesFromBottomMm({
      boxExternalHeightMm: H,
      drawerCount: n,
      descontoPainelMm: T,
    });
    expect(pitch[0]).toBeCloseTo(41, 5);
    expect(pitch[1]).toBeCloseTo(288.6666667, 5);
    expect(pitch[2]).toBeCloseTo(555.3333333, 5);

    const panelH = H - 2 * T;
    const runnerFromTop = resolveEuropeanModuleRunnerLinesYMm({
      panelHeightMm: panelH,
      boxInternalHeightMm: H,
      boxExternalHeightMm: H,
      floorThicknessMm: T,
      drawers: layers.map((l) => ({
        posYMm: l.posY!,
        frontHeightMm: l.height!,
      })),
    });
    const fromBottom = runnerFromTop.map((yTop) => panelH - yTop);
    expect(fromBottom[0]).toBeCloseTo(41, 3);
    expect(fromBottom[1]).toBeCloseTo(288.6666667, 3);
    expect(fromBottom[2]).toBeCloseTo(555.3333333, 3);
  });
});
