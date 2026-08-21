/**
 * Guarda SSOT — GAV_1 clássico: bodyBottom = floorTop + 18,5; guia = 41.
 * Não usar base exterior como datum do corpo.
 */
import { describe, expect, it } from "vitest";
import {
  DRAWER_GAV1_MODULE_GUIDE_AXIS_MM,
  DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM,
  drawerGroupToLayerItems,
  generateDrawerGroup,
  resolveClassicExteriorLowestBodyElevationFromFrontMm,
} from "../core/drawers";
import { resolveEuropeanModuleRunnerLinesYMm } from "../core/drawers/drilling/DrawerDrillingRules";
import { settingsDefaults } from "../core/settings/settingsSchema";

describe("GAV_1 SSOT — bodyBottom floorTop + guia 41", () => {
  it("clássico equal — bodyBottom = 18,5 desde floorTop; guia = 41", () => {
    const H = 800;
    const T = 19;
    const group = generateDrawerGroup({
      boxWidth: 600,
      boxHeight: H,
      boxDepth: 560,
      boxThickness: T,
      boxId: "verif-gav1",
      drawerCount: 3,
      drawerType: "normal",
      heightMode: "equal",
      availableDepths: settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      drawerSettings: settingsDefaults.gavetas,
      espessuraCostaMm: 10,
      costaAtiva: true,
    });
    const layers = drawerGroupToLayerItems(group);
    const L0 = layers[0]!;
    const floorTop = -H / 2 + T;
    const bodyBottom =
      L0.posY! + (L0.bodyCenterOffsetY ?? 0) - L0.bodyHeight! / 2;

    expect(bodyBottom - floorTop).toBeCloseTo(DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM, 5);
    expect(L0.metadata?.sideBaseElevationMm).toBeCloseTo(
      resolveClassicExteriorLowestBodyElevationFromFrontMm(T),
      5
    );

    const panelH = H - 2 * T;
    const fromTop = resolveEuropeanModuleRunnerLinesYMm({
      panelHeightMm: panelH,
      boxInternalHeightMm: H,
      boxExternalHeightMm: H,
      floorThicknessMm: T,
      drawers: layers.map((d) => ({
        posYMm: d.posY!,
        frontHeightMm: d.height!,
        sideBaseElevationMm: d.metadata?.sideBaseElevationMm as number,
      })),
    });
    expect(panelH - fromTop[0]!).toBeCloseTo(DRAWER_GAV1_MODULE_GUIDE_AXIS_MM, 5);
  });

  it("elevação clássica exterior T=19 → 35,5 (compõe body 18,5 desde floorTop)", () => {
    expect(resolveClassicExteriorLowestBodyElevationFromFrontMm(19)).toBe(35.5);
  });
});
