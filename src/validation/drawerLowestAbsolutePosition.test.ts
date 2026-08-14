/**
 * Posição absoluta do gaveta inferior (GAV_1) — Diff 3:
 * frente a 0 mm da base (B0); elevação corpo 48 mm; lateral = frente − 85,5.
 */
import { describe, expect, it } from "vitest";
import {
  generateDrawerGroup,
  drawerGroupToLayerItems,
  DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM,
  DRAWER_BODY_DELTA_LOWEST_MM,
  DRAWER_BODY_DELTA_UPPER_MM,
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
  const elev = 48;
  const frontBottomIndustrial = 0;
  const bodyBottomIndustrial = frontBottomIndustrial + elev; // 48

  it("constantes SSOT GAV_1 (Diff 3)", () => {
    expect(DRAWER_LOWEST_FRONT_BOTTOM_FROM_MODULE_BASE_MM).toBe(0);
    expect(DRAWER_VERTICAL_BASE_OFFSET_MM).toBe(0);
    expect(DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM).toBe(48);
    expect(DRAWER_BODY_DELTA_LOWEST_MM).toBe(85.5);
    expect(DRAWER_BODY_DELTA_UPPER_MM).toBe(68.5);
    expect(resolveLowestDrawerBodyElevationFromFrontMm(T)).toBe(elev);
    expect(resolveDrawerBodyElevationForStackRoleMm("lowest", T)).toBe(elev);
    expect(resolveDrawerBodyElevationForStackRoleMm("single", T)).toBe(elev);
    expect(resolveDrawerBodyElevationForStackRoleMm("middle", T)).toBe(elev);
    expect(resolveDrawerBodyElevationForStackRoleMm("highest", T)).toBe(elev);
    expect(DRAWER_SIDE_BASE_ELEVATION_MM).toBe(48);
    expect(DRAWER_SLIDE_OFFSET_FROM_BOTTOM_MM).toBe(41);
  });

  it("generateDrawerGroup — frente B0=0; corpo E=48 → bodyBottom 48; delta 85,5/68,5", () => {
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
    expect(layers[0]!.metadata?.sideBaseElevationMm).toBe(elev);
    expect(layers[1]!.metadata?.sideBaseElevationMm).toBe(elev);

    const frontH0 = layers[0]!.height!;
    const frontH1 = layers[1]!.height!;
    expect(layers[0]!.bodyHeight).toBeCloseTo(frontH0 - DRAWER_BODY_DELTA_LOWEST_MM, 5);
    expect(layers[1]!.bodyHeight).toBeCloseTo(frontH1 - DRAWER_BODY_DELTA_UPPER_MM, 5);

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
        sideBaseElevationMm: elev,
      })
    ).toBeCloseTo(bodyBottomIndustrial, 5);
  });

  it("furos: lowest — rasgo elev+sideH−13; cavilha inferior elev+15", () => {
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
      sideBaseElevationMm: elev,
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
      sideBaseElevationMm: elev,
    });
    const grooveYLow = elev + sideH - 13;
    const grooveYHigh = elev + sideHHigh - 13;
    expect(lowest.find((h) => h.holeSubtype === "groove")?.y).toBe(grooveYLow);
    expect(highest.find((h) => h.holeSubtype === "groove")?.y).toBe(grooveYHigh);
    const lowerCavLow = Math.min(
      ...lowest.filter((h) => h.tipo === "cavilha").map((h) => h.y)
    );
    expect(lowerCavLow).toBeCloseTo(elev + 15, 5);
    expect(lowest.find((h) => h.holeSubtype === "groove")?.profundidade).toBe(11);
  });

  it("viewer/layout: lateral inferior elev=48 vs frente; delta 85,5", () => {
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
    expect(elevMeta).toBe(elev);
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
