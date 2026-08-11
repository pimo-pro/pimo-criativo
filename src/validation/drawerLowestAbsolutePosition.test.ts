/**
 * Posição absoluta do gaveta inferior:
 * frente flush (0); corpo T+18,5 acima da base (= 18,5 mm acima do topo do FUNDO).
 * Superior: elev=12,5 (folga CIMA ≥33 mm). Laterais unificadas h−64,5.
 */
import { describe, expect, it } from "vitest";
import {
  generateDrawerGroup,
  drawerGroupToLayerItems,
  DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM,
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
  const elevLowest = T + 18.5; // 37.5 — folga 18,5 acima do topo do FUNDO

  it("constantes SSOT", () => {
    expect(DRAWER_LOWEST_FRONT_BOTTOM_FROM_MODULE_BASE_MM).toBe(0);
    expect(DRAWER_VERTICAL_BASE_OFFSET_MM).toBe(0);
    expect(DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM).toBe(18.5);
    expect(resolveLowestDrawerBodyElevationFromFrontMm(T)).toBe(elevLowest);
    expect(DRAWER_HIGHEST_BODY_ELEVATION_FROM_FRONT_MM).toBe(12.5);
    expect(resolveDrawerBodyElevationForStackRoleMm("lowest", T)).toBe(elevLowest);
    expect(resolveDrawerBodyElevationForStackRoleMm("middle", T)).toBe(17);
    // middle/highest unificados (intercambiabilidade 2ª/3ª gaveta) — ver drawerStackPosition.ts
    expect(resolveDrawerBodyElevationForStackRoleMm("highest", T)).toBe(17);
    expect(DRAWER_SLIDE_OFFSET_FROM_BOTTOM_MM).toBe(41);
  });

  it("generateDrawerGroup — frente 0; corpo T+18,5 (=18,5 acima do FUNDO); superior 17 (unificado)", () => {
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

    expect(geo0.frontBottomFromModuleBaseMm).toBeCloseTo(0, 5);
    expect(layers[0]!.metadata?.sideBaseElevationMm).toBe(elevLowest);
    // middle/highest unificados — ver drawerStackPosition.ts
    expect(layers[1]!.metadata?.sideBaseElevationMm).toBe(DRAWER_SIDE_BASE_ELEVATION_MM);
    expect(layers[0]!.bodyHeight).toBeCloseTo(layers[1]!.bodyHeight!, 5);

    const frontH = layers[0]!.height!;
    const bodyH = layers[0]!.bodyHeight!;
    const offsetY = layers[0]!.bodyCenterOffsetY!;
    const moduleBase = -boxH / 2;
    const frontBottom = layers[0]!.posY! - frontH / 2;
    const bodyBottom = layers[0]!.posY! + offsetY - bodyH / 2;
    const fundoTop = moduleBase + T;

    expect(frontBottom - moduleBase).toBeCloseTo(0, 5);
    expect(bodyBottom - moduleBase).toBeCloseTo(elevLowest, 5);
    expect(bodyBottom - fundoTop).toBeCloseTo(18.5, 5);
    expect(
      resolveDrawerBodyBottomFromModuleBaseMm({
        frontBottomFromModuleBaseMm: geo0.frontBottomFromModuleBaseMm,
        sideBaseElevationMm: elevLowest,
      })
    ).toBeCloseTo(elevLowest, 5);

    const elevHigh = layers[1]!.metadata?.sideBaseElevationMm as number;
    const bodyH1 = layers[1]!.bodyHeight!;
    const offsetY1 = layers[1]!.bodyCenterOffsetY!;
    const bodyTop1 = layers[1]!.posY! + offsetY1 + bodyH1 / 2;
    const cimaUnderside = moduleBase + boxH - T;
    // folga CIMA = 64,5 − T − elevação = 64,5 − 19 − 17 = 28,5 mm (era 33 mm com elev=12,5)
    expect(cimaUnderside - bodyTop1).toBeGreaterThanOrEqual(28.5 - 0.05);
    expect(elevHigh).toBe(17);
    expect(DRAWER_SIDE_BASE_ELEVATION_MM).toBe(17);
  });

  it("furos: lowest e highest — rasgo elev+sideH−13; cavilha inferior elev+15 (padrão uniforme)", () => {
    const frontH = 358;
    const sideH = resolveDrawerWoodBodyHeightMm(frontH, "lowest");
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
      sideHeightMm: sideH,
      bodyWidthMm: 548,
      sideThicknessMm: 16,
      bottomThicknessMm: 10,
      sideBaseElevationMm: elevHigh,
    });
    const grooveYLow = elevLow + sideH - 13;
    const grooveYHigh = elevHigh + sideH - 13;
    expect(lowest.find((h) => h.holeSubtype === "groove")?.y).toBe(grooveYLow);
    expect(highest.find((h) => h.holeSubtype === "groove")?.y).toBe(grooveYHigh);
    expect(lowest.filter((h) => h.tipo === "cavilha").length).toBe(
      highest.filter((h) => h.tipo === "cavilha").length
    );
    const lowerCavLow = Math.min(
      ...lowest.filter((h) => h.tipo === "cavilha").map((h) => h.y)
    );
    expect(lowerCavLow).toBeCloseTo(elevLow + 15, 5);
    const upperCavHigh = Math.max(
      ...highest.filter((h) => h.tipo === "cavilha").map((h) => h.y)
    );
    expect(grooveYHigh - upperCavHigh).toBeCloseTo(22, 5);
    expect(lowest.find((h) => h.holeSubtype === "groove")?.profundidade).toBe(11);
  });

  it("viewer/layout: lateral inferior 18,5 mm acima do topo do FUNDO (T=19 → elev 37,5)", () => {
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

    // Folga visual sobre FUNDO: elev − T = 18,5
    expect(elev - T).toBeCloseTo(18.5, 5);

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
    // Rasgo uniforme: elev + sideH − 13 (22 mm à cavilha superior).
    expect(holes.find((h) => h.holeSubtype === "groove")?.y).toBe(elev + sideH - 13);
    expect(holes.filter((h) => h.tipo === "cavilha").length).toBeGreaterThanOrEqual(2);
    expect(holes.find((h) => h.holeSubtype === "groove")?.profundidade).toBe(11);
  });
});
