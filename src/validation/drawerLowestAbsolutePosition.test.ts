/**
 * Posição absoluta do gaveta inferior (GAV_1):
 * frente a 2 mm da base; corpo elevação 16,5 mm vs frente → bodyBottom=18,5; Δ=22,5.
 * Ratio laterais R_real = 0,685. Middle/highest: elev=17, ratio Admin 0,75.
 */
import { describe, expect, it } from "vitest";
import {
  generateDrawerGroup,
  drawerGroupToLayerItems,
  DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM,
  DRAWER_LOWEST_SIDE_HEIGHT_RATIO,
  DRAWER_HIGHEST_BODY_ELEVATION_FROM_FRONT_MM,
  DRAWER_LOWEST_FRONT_BOTTOM_FROM_MODULE_BASE_MM,
  DRAWER_VERTICAL_BASE_OFFSET_MM,
  resolveDrawerFrontStackGeometry,
  resolveDrawerBodyBottomFromModuleBaseMm,
  resolveLowestDrawerBodyElevationFromFrontMm,
  resolveDrawerBodyElevationForStackRoleMm,
} from "../core/drawers";
import { DRAWER_SIDE_BASE_ELEVATION_MM } from "../core/drawers/drawerGeometryConstants";
import { DRAWER_SLIDE_OFFSET_FROM_BOTTOM_MM } from "../core/drawers/drilling/drawerDowelInterlock";
import { computeDrawerFrenteExtStructuralHoles } from "../core/drawers/drilling/DrawerDrillingRules";
import {
  resolveDrawerWoodBodyHeightMm,
  resolveDrawerViewerWoodSideLayoutMm,
} from "../core/drawers/drawerViewerLayout";
import { settingsDefaults } from "../core/settings/settingsSchema";

describe("gaveta inferior — posição absoluta corpo/frente", () => {
  const T = 19;
  /** GAV_1: elevação absoluta industrial (não T+folga). */
  const elevLowest = 16.5;
  const frontBottomIndustrial = 2;
  const bodyBottomIndustrial = frontBottomIndustrial + elevLowest; // 18.5

  it("constantes SSOT GAV_1", () => {
    expect(DRAWER_LOWEST_FRONT_BOTTOM_FROM_MODULE_BASE_MM).toBe(2);
    expect(DRAWER_VERTICAL_BASE_OFFSET_MM).toBe(2);
    expect(DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM).toBe(16.5);
    expect(DRAWER_LOWEST_SIDE_HEIGHT_RATIO).toBe(0.685);
    expect(resolveLowestDrawerBodyElevationFromFrontMm(T)).toBe(elevLowest);
    expect(DRAWER_HIGHEST_BODY_ELEVATION_FROM_FRONT_MM).toBe(12.5);
    expect(resolveDrawerBodyElevationForStackRoleMm("lowest", T)).toBe(elevLowest);
    expect(resolveDrawerBodyElevationForStackRoleMm("single", T)).toBe(T + 18.5);
    expect(resolveDrawerBodyElevationForStackRoleMm("middle", T)).toBe(17);
    expect(resolveDrawerBodyElevationForStackRoleMm("highest", T)).toBe(17);
    expect(DRAWER_SLIDE_OFFSET_FROM_BOTTOM_MM).toBe(41);
    // Δ = eixo 41 − bodyBottom 18,5 = 22,5
    expect(DRAWER_SLIDE_OFFSET_FROM_BOTTOM_MM - bodyBottomIndustrial).toBeCloseTo(22.5, 5);
  });

  it("generateDrawerGroup — frente 2; corpo E=16,5 → bodyBottom 18,5; R=0,685", () => {
    const boxH = 720;
    const group = generateDrawerGroup({
      boxWidth: 600,
      boxHeight: boxH,
      boxDepth: 560,
      boxThickness: T,
      boxId: "abs-pos",
      drawerCount: 2,
      drawerType: "normal",
      heightMode: "equal",
      availableDepths: settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      drawerSettings: settingsDefaults.gavetas,
      espessuraCostaMm: 10,
      costaAtiva: true,
    });
    const layers = drawerGroupToLayerItems(group);
    const heights = layers.map((l) => l.height!);
    const geo0 = resolveDrawerFrontStackGeometry({
      drawerIndex0Based: 0,
      drawerHeights: heights,
      boxInternalHeightMm: boxH,
      posYMm: layers[0]!.posY!,
    });

    expect(geo0.frontBottomFromModuleBaseMm).toBeCloseTo(frontBottomIndustrial, 5);
    expect(geo0.flushToModuleBase).toBe(true);
    expect(layers[0]!.metadata?.sideBaseElevationMm).toBe(elevLowest);
    expect(layers[1]!.metadata?.sideBaseElevationMm).toBe(DRAWER_SIDE_BASE_ELEVATION_MM);

    const frontH0 = layers[0]!.height!;
    const frontH1 = layers[1]!.height!;
    expect(layers[0]!.bodyHeight).toBeCloseTo(frontH0 * DRAWER_LOWEST_SIDE_HEIGHT_RATIO, 5);
    expect(layers[1]!.bodyHeight).toBeCloseTo(frontH1 * 0.75, 5);

    const frontH = layers[0]!.height!;
    const bodyH = layers[0]!.bodyHeight!;
    const offsetY = layers[0]!.bodyCenterOffsetY!;
    const moduleBase = -boxH / 2;
    const frontBottom = layers[0]!.posY! - frontH / 2;
    const bodyBottom = layers[0]!.posY! + offsetY - bodyH / 2;

    expect(frontBottom - moduleBase).toBeCloseTo(frontBottomIndustrial, 5);
    expect(bodyBottom - moduleBase).toBeCloseTo(bodyBottomIndustrial, 5);
    expect(
      resolveDrawerBodyBottomFromModuleBaseMm({
        frontBottomFromModuleBaseMm: geo0.frontBottomFromModuleBaseMm,
        sideBaseElevationMm: elevLowest,
      })
    ).toBeCloseTo(bodyBottomIndustrial, 5);

    const elevHigh = layers[1]!.metadata?.sideBaseElevationMm as number;
    const bodyH1 = layers[1]!.bodyHeight!;
    const offsetY1 = layers[1]!.bodyCenterOffsetY!;
    const bodyTop1 = layers[1]!.posY! + offsetY1 + bodyH1 / 2;
    const cimaUnderside = moduleBase + boxH - T;
    expect(cimaUnderside - bodyTop1).toBeGreaterThanOrEqual(28.5 - 0.05);
    expect(elevHigh).toBe(17);
    expect(DRAWER_SIDE_BASE_ELEVATION_MM).toBe(17);
  });

  it("furos: lowest — rasgo elev+sideH−13; cavilha inferior elev+15", () => {
    const frontH = 358;
    const sideH = resolveDrawerWoodBodyHeightMm(frontH, "lowest");
    expect(sideH).toBeCloseTo(frontH * DRAWER_LOWEST_SIDE_HEIGHT_RATIO, 5);
    const elevLow = elevLowest;
    const elevHigh = 12.5;
    const lowest = computeDrawerFrenteExtStructuralHoles({
      largura: 598,
      altura: frontH,
      espessura: 19,
      stackRole: "lowest",
      sideHeightMm: sideH,
      bodyWidthMm: 548,
      sideThicknessMm: 16,
      bottomThicknessMm: 10,
      sideBaseElevationMm: elevLow,
    });
    const highest = computeDrawerFrenteExtStructuralHoles({
      largura: 598,
      altura: frontH,
      espessura: 19,
      stackRole: "highest",
      isLowestDrawer: false,
      sideHeightMm: resolveDrawerWoodBodyHeightMm(frontH, "highest"),
      bodyWidthMm: 548,
      sideThicknessMm: 16,
      bottomThicknessMm: 10,
      sideBaseElevationMm: elevHigh,
    });
    const grooveYLow = elevLow + sideH - 13;
    const grooveYHigh = elevHigh + resolveDrawerWoodBodyHeightMm(frontH, "highest") - 13;
    expect(lowest.find((h) => h.holeSubtype === "groove")?.y).toBe(grooveYLow);
    expect(highest.find((h) => h.holeSubtype === "groove")?.y).toBe(grooveYHigh);
    const lowerCavLow = Math.min(
      ...lowest.filter((h) => h.tipo === "cavilha").map((h) => h.y)
    );
    expect(lowerCavLow).toBeCloseTo(elevLow + 15, 5);
    expect(lowest.find((h) => h.holeSubtype === "groove")?.profundidade).toBe(11);
  });

  it("viewer/layout: lateral inferior elev=16,5 vs frente; ratio 0,685", () => {
    const boxH = 762;
    const group = generateDrawerGroup({
      boxWidth: 600,
      boxHeight: boxH,
      boxDepth: 500,
      boxThickness: T,
      boxId: "viewer-elev",
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
    const elev = L0.metadata?.sideBaseElevationMm as number;
    expect(elev).toBe(elevLowest);
    expect(L0.bodyHeight).toBeCloseTo(L0.height! * DRAWER_LOWEST_SIDE_HEIGHT_RATIO, 5);

    const layout = resolveDrawerViewerWoodSideLayoutMm({
      frontPosYMm: L0.frontPosY ?? 0,
      frontHeightMm: L0.height!,
      bodyWidthMm: L0.bodyWidth!,
      sideThicknessMm: L0.leftSideWidth ?? 16,
      slideLengthMm: L0.bodyDepth!,
      baseElevationMm: elev,
      sideHeightMm: L0.leftSideHeight,
    });
    const frontBottomLocal = (L0.frontPosY ?? 0) - L0.height! / 2;
    const sideBottomLocal = layout.sidePosYMm - layout.sideHeightMm / 2;
    expect(sideBottomLocal - frontBottomLocal).toBeCloseTo(elevLowest, 5);
    expect(layout.sideHeightMm).toBeCloseTo(L0.leftSideHeight!, 5);

    const sideH = L0.leftSideHeight!;
    const holes = computeDrawerFrenteExtStructuralHoles({
      largura: L0.width!,
      altura: L0.height!,
      espessura: L0.frontThickness ?? 19,
      stackRole: "lowest",
      sideHeightMm: sideH,
      bodyWidthMm: L0.bodyWidth!,
      sideThicknessMm: L0.leftSideWidth ?? 16,
      bottomThicknessMm: L0.bottomThickness ?? 10,
      sideBaseElevationMm: elev,
    });
    const lowerCav = Math.min(
      ...holes.filter((h) => h.tipo === "cavilha").map((h) => h.y)
    );
    expect(lowerCav).toBeCloseTo(elev + 15, 5);
  });
});
