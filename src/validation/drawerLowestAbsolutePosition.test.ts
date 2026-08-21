/**
 * Posição absoluta do gaveta inferior (GAV_1) — verdade de fábrica:
 * frente a 2 mm da base (B0); elevação corpo 16,5 mm; bodyBottom 18,5;
 * guia módulo 41 → dY lado↔guia = 22,5; lateral = frente − 85,5.
 */
import { describe, expect, it } from "vitest";
import {
  generateDrawerGroup,
  drawerGroupToLayerItems,
  DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM,
  DRAWER_BODY_DELTA_LOWEST_MM,
  DRAWER_BODY_DELTA_UPPER_MM,
  DRAWER_LOWEST_FRONT_BOTTOM_FROM_MODULE_BASE_MM,
  DRAWER_LOWEST_BODY_ELEVATION_FROM_FRONT_MM,
  DRAWER_SLIDE_AXIS_FROM_DRAWER_SIDE_BOTTOM_MM,
  DRAWER_VERTICAL_BASE_OFFSET_MM,
  resolveDrawerFrontStackGeometry,
  resolveDrawerBodyBottomFromModuleBaseMm,
  resolveLowestDrawerBodyElevationFromFrontMm,
  resolveDrawerBodyElevationForStackRoleMm,
} from "../core/drawers";
import { DRAWER_BODY_ELEVATION_FROM_FRONT_MM } from "../core/drawers/drawerGeometryConstants";
import { DRAWER_SLIDE_OFFSET_FROM_BOTTOM_MM } from "../core/drawers/drilling/drawerDowelInterlock";
import { DEFAULT_CORREDICA_EIXO_GAVETA1_MM } from "../core/drawers/drilling/DrawerDrillingRules";
import { computeDrawerFrenteExtStructuralHoles } from "../core/drawers/drilling/DrawerDrillingRules";
import {
  resolveDrawerWoodBodyHeightMm,
  resolveDrawerViewerWoodSideLayoutMm,
} from "../core/drawers/drawerViewerLayout";
import { settingsDefaults } from "../core/settings/settingsSchema";

describe("gaveta inferior — posição absoluta corpo/frente", () => {
  const T = 19;
  const elevLowest = DRAWER_LOWEST_BODY_ELEVATION_FROM_FRONT_MM; // 16.5
  const elevUpper = DRAWER_BODY_ELEVATION_FROM_FRONT_MM; // 48
  const frontBottomIndustrial = 2;
  const bodyBottomIndustrial = frontBottomIndustrial + elevLowest; // 18.5

  it("constantes SSOT GAV_1 (fábrica: B0=2, elev=16,5, body=18,5, dY guia=22,5)", () => {
    expect(DRAWER_LOWEST_FRONT_BOTTOM_FROM_MODULE_BASE_MM).toBe(2);
    expect(DRAWER_VERTICAL_BASE_OFFSET_MM).toBe(2);
    expect(DRAWER_LOWEST_BODY_ELEVATION_FROM_FRONT_MM).toBe(16.5);
    expect(DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM).toBe(18.5);
    expect(DRAWER_SLIDE_AXIS_FROM_DRAWER_SIDE_BOTTOM_MM).toBe(22.5);
    expect(DEFAULT_CORREDICA_EIXO_GAVETA1_MM - DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM).toBeCloseTo(
      DRAWER_SLIDE_AXIS_FROM_DRAWER_SIDE_BOTTOM_MM,
      5
    );
    expect(DRAWER_BODY_DELTA_LOWEST_MM).toBe(85.5);
    expect(DRAWER_BODY_DELTA_UPPER_MM).toBe(68.5);
    expect(resolveLowestDrawerBodyElevationFromFrontMm(T)).toBe(elevLowest);
    expect(resolveDrawerBodyElevationForStackRoleMm("lowest", T)).toBe(elevLowest);
    expect(resolveDrawerBodyElevationForStackRoleMm("single", T)).toBe(elevLowest);
    expect(resolveDrawerBodyElevationForStackRoleMm("middle", T)).toBe(elevUpper);
    expect(resolveDrawerBodyElevationForStackRoleMm("highest", T)).toBe(elevUpper);
    expect(DRAWER_SLIDE_OFFSET_FROM_BOTTOM_MM).toBe(41);
  });

  it("generateDrawerGroup — frente B0=2; corpo elev=16,5 → bodyBottom 18,5; delta 85,5/68,5", () => {
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
    expect(layers[0]!.metadata?.sideBaseElevationMm).toBeCloseTo(
      DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM -
        (DRAWER_LOWEST_FRONT_BOTTOM_FROM_MODULE_BASE_MM - T),
      5
    );
    expect(layers[1]!.metadata?.sideBaseElevationMm).toBe(elevUpper);

    const frontH0 = layers[0]!.height!;
    const frontH1 = layers[1]!.height!;
    expect(layers[0]!.bodyHeight).toBeCloseTo(frontH0 - DRAWER_BODY_DELTA_LOWEST_MM, 5);
    expect(layers[1]!.bodyHeight).toBeCloseTo(frontH1 - DRAWER_BODY_DELTA_UPPER_MM, 5);

    const frontH = layers[0]!.height!;
    const bodyH = layers[0]!.bodyHeight!;
    const offsetY = layers[0]!.bodyCenterOffsetY!;
    const floorTop = -boxH / 2 + T;
    const frontBottom = layers[0]!.posY! - frontH / 2;
    const bodyBottom = layers[0]!.posY! + offsetY - bodyH / 2;

    // Frente na base exterior; corpo a 18,5 acima do floorTop (SSOT).
    expect(frontBottom - (-boxH / 2)).toBeCloseTo(frontBottomIndustrial, 5);
    expect(bodyBottom - floorTop).toBeCloseTo(bodyBottomIndustrial, 5);
    expect(
      resolveDrawerBodyBottomFromModuleBaseMm({
        frontBottomFromModuleBaseMm: geo0.frontBottomFromModuleBaseMm,
        sideBaseElevationMm: elevLowest,
        stackRole: "lowest",
      })
    ).toBeCloseTo(bodyBottomIndustrial, 5);
  });

  it("furos: lowest — rasgo elev+sideH−13; cavilha inferior elev+54 → Y_peça 70,5", () => {
    const frontH = 358;
    const sideH = resolveDrawerWoodBodyHeightMm(frontH, "lowest");
    expect(sideH).toBeCloseTo(frontH - DRAWER_BODY_DELTA_LOWEST_MM, 5);
    const lowest = computeDrawerFrenteExtStructuralHoles({
      largura: 598,
      altura: frontH,
      espessura: 19,
      stackRole: "lowest",
      sideHeightMm: sideH,
      bodyWidthMm: 548,
      sideThicknessMm: 16,
      bottomThicknessMm: 10,
      sideBaseElevationMm: elevLowest,
    });
    const sideHHigh = resolveDrawerWoodBodyHeightMm(frontH, "highest");
    const highest = computeDrawerFrenteExtStructuralHoles({
      largura: 598,
      altura: frontH,
      espessura: 19,
      stackRole: "highest",
      isLowestDrawer: false,
      sideHeightMm: sideHHigh,
      bodyWidthMm: 548,
      sideThicknessMm: 16,
      bottomThicknessMm: 10,
      sideBaseElevationMm: elevUpper,
    });
    const grooveYLow = elevLowest + sideH - 13;
    const grooveYHigh = elevUpper + sideHHigh - 13;
    expect(lowest.find((h) => h.holeSubtype === "groove")?.y).toBe(grooveYLow);
    expect(highest.find((h) => h.holeSubtype === "groove")?.y).toBe(grooveYHigh);
    const lowerCavLow = Math.min(
      ...lowest.filter((h) => h.tipo === "cavilha").map((h) => h.y)
    );
    expect(lowerCavLow).toBeCloseTo(elevLowest + 54, 5);
    expect(lowerCavLow).toBeCloseTo(70.5, 5);
    expect(lowest.find((h) => h.holeSubtype === "groove")?.profundidade).toBe(11);
  });

  it("viewer/layout: GAV_1 clássico — elev compensada; bodyBottom floorTop+18,5; delta 85,5", () => {
    const boxH = 720;
    const group = generateDrawerGroup({
      boxWidth: 600,
      boxHeight: boxH,
      boxDepth: 560,
      boxThickness: T,
      boxId: "viewer-abs",
      drawerCount: 1,
      drawerType: "normal",
      heightMode: "equal",
      availableDepths: settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      drawerSettings: settingsDefaults.gavetas,
      espessuraCostaMm: 10,
      costaAtiva: true,
    });
    const layers = drawerGroupToLayerItems(group);
    const L0 = layers[0]!;
    const elevMeta = L0.metadata?.sideBaseElevationMm as number;
    const floorTop = -boxH / 2 + T;
    const bodyBottom =
      L0.posY! + (L0.bodyCenterOffsetY ?? 0) - L0.bodyHeight! / 2;
    expect(elevMeta).toBeCloseTo(DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM - (DRAWER_LOWEST_FRONT_BOTTOM_FROM_MODULE_BASE_MM - T), 5);
    expect(bodyBottom - floorTop).toBeCloseTo(DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM, 5);
    expect(L0.bodyHeight).toBeCloseTo(L0.height! - DRAWER_BODY_DELTA_LOWEST_MM, 5);

    const layout = resolveDrawerViewerWoodSideLayoutMm({
      frontPosYMm: L0.posY ?? 0,
      frontHeightMm: L0.height!,
      bodyWidthMm: L0.bodyWidth ?? 548,
      sideThicknessMm: L0.sideThickness ?? 16,
      slideLengthMm: L0.nominalDepthMm ?? L0.bodyDepth ?? 500,
      sideHeightMm: L0.bodyHeight!,
      baseElevationMm: elevMeta,
    });
    expect(layout.sideHeightMm).toBeCloseTo(L0.bodyHeight!, 5);
  });
});
