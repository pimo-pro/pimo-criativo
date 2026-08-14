/**
 * Frentes de gaveta alinhadas — posição no módulo (inferior / superior / interm²dia).
 */
import { describe, expect, it } from "vitest";
import {
  calculateDrawerHeights,
  calculateDrawerPositions,
  generateDrawerGroup,
  drawerGroupToLayerItems,
  DRAWER_VERTICAL_BASE_OFFSET_MM,
  resolveDrawerFrontStackGeometry,
  resolveDrawerStackRole,
} from "../core/drawers";
import {
  DRAWER_SIDE_BASE_ELEVATION_MM,
  DRAWER_VERTICAL_GAP_MM,
} from "../core/drawers/drawerGeometryConstants";
import { resolveDrawerWoodBodyHeightMm } from "../core/drawers/drawerViewerLayout";
import {
  getDrawerFrontDowelYPositionsMm,
} from "../core/drawers/drilling/drawerDowelInterlock";
import {
  computeDrawerFrenteExtStructuralHoles,
} from "../core/drawers/drilling/DrawerDrillingRules";
import { cutlistComPrecoFromBox } from "../core/manufacturing/cutlistFromBoxes";
import { defaultRulesConfig } from "../core/rules/rulesConfig";
import { buildDrillStationXmlFilesForProject } from "../core/drill/drillExport";
import { isDrawerPieceTipo } from "../services/drawerCutlistAdapter";
import { settingsDefaults } from "../core/settings/settingsSchema";
import {
  buildDrawerScenario,
  minimalBoxWithDrawers,
} from "./drawerCertificationTestHelpers";

describe("gav_frente — stack vertical por posição no módulo", () => {
  it("offset de base = 2 mm (frente inferior GAV_1 acima do fundo da caixa)", () => {
    expect(DRAWER_VERTICAL_BASE_OFFSET_MM).toBe(2);
  });

  it("módulo 2 gavetas iguais 720 mm — frentes (H−B0−gap)/2; datum base 2 mm e CIMA", () => {
    const boxH = 720;
    const heights = calculateDrawerHeights(2, boxH, "equal");
    const expectedEach = (boxH - DRAWER_VERTICAL_BASE_OFFSET_MM - DRAWER_VERTICAL_GAP_MM) / 2;
    expect(heights).toEqual([expectedEach, expectedEach]);

    const positions = calculateDrawerPositions(heights, boxH);
    const lower = resolveDrawerFrontStackGeometry({
      drawerIndex0Based: 0,
      drawerHeights: heights,
      boxInternalHeightMm: boxH,
      posYMm: positions[0]!,
    });
    const upper = resolveDrawerFrontStackGeometry({
      drawerIndex0Based: 1,
      drawerHeights: heights,
      boxInternalHeightMm: boxH,
      posYMm: positions[1]!,
    });

    expect(lower.role).toBe("lowest");
    expect(upper.role).toBe("highest");
    expect(lower.flushToModuleBase).toBe(true);
    expect(upper.flushToModuleTop).toBe(true);
    expect(lower.frontBottomFromModuleBaseMm).toBeCloseTo(DRAWER_VERTICAL_BASE_OFFSET_MM, 5);
    expect(upper.frontTopFromModuleBaseMm).toBeCloseTo(boxH, 5);
  });

  it("furos/rasgo — inferior e superior: mesmo padrão elev+15 / elev+sideH−35; rasgo a 22 mm da cavilha superior", () => {
    const frontH = 358;
    const sideH = resolveDrawerWoodBodyHeightMm(frontH);
    const elev = DRAWER_SIDE_BASE_ELEVATION_MM;

    const holesLowest = computeDrawerFrenteExtStructuralHoles({
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
    const holesUpper = computeDrawerFrenteExtStructuralHoles({
      largura: 598,
      altura: frontH,
      espessura: 19,
      stackRole: "highest",
      isLowestDrawer: false,
      sideHeightMm: sideH,
      bodyWidthMm: 548,
      sideThicknessMm: 16,
      bottomThicknessMm: 10,
      sideBaseElevationMm: elev,
    });

    const expectedYs = getDrawerFrontDowelYPositionsMm(sideH, false).map((y) => y + elev);
    const ysUpper = [...new Set(holesUpper.filter((h) => h.tipo === "cavilha").map((h) => h.y))].sort(
      (a, b) => a - b
    );
    const ysLowest = [...new Set(holesLowest.filter((h) => h.tipo === "cavilha").map((h) => h.y))].sort(
      (a, b) => a - b
    );
    expect(ysUpper).toEqual(expectedYs);
    expect(ysLowest).toEqual(expectedYs);
    const grooveY = elev + sideH - 13;
    expect(holesUpper.find((h) => h.holeSubtype === "groove")?.y).toBe(grooveY);
    expect(holesLowest.find((h) => h.holeSubtype === "groove")?.y).toBe(grooveY);
    const upperCavY = Math.max(...expectedYs);
    expect(grooveY - upperCavY).toBeCloseTo(22, 5);
    expect(Math.min(...expectedYs)).toBe(elev + 15);
  });

  it("pipeline 2 gavetas — cutlist + DRILL: roles e furos", () => {
    const boxH = 720;
    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: boxH,
      boxDepth: 560,
      drawerCount: 2,
    });
    const box = minimalBoxWithDrawers(layers);
    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig).filter((p) =>
      isDrawerPieceTipo(p.tipo)
    );
    const fronts = cutlist
      .filter((p) => p.tipo === "gaveta_frente_ext")
      .sort(
        (a, b) =>
          (Number(a.metadata?.drawerIndex) || 0) - (Number(b.metadata?.drawerIndex) || 0)
      );
    expect(fronts).toHaveLength(2);
    expect(fronts[0]!.metadata?.drawerRules).toMatchObject({ stackRole: "lowest" });
    expect(fronts[1]!.metadata?.drawerRules).toMatchObject({ stackRole: "highest" });
    const groove0 = fronts[0]!.drillHoles?.find((h) => h.holeSubtype === "groove");
    const groove1 = fronts[1]!.drillHoles?.find((h) => h.holeSubtype === "groove");
    expect(groove0).toBeDefined();
    expect(groove1).toBeDefined();
    // Inferior e superior: rasgo a 22 mm da cavilha superior (padrão uniforme).
    const cav0 = fronts[0]!.drillHoles!.filter((h) => h.holeType === "cavilha");
    const cav1 = fronts[1]!.drillHoles!.filter((h) => h.holeType === "cavilha");
    const upperCav0 = Math.max(...cav0.map((h) => h.y));
    const upperCav1 = Math.max(...cav1.map((h) => h.y));
    expect(groove0!.y - upperCav0).toBeCloseTo(22, 5);
    expect(groove1!.y - upperCav1).toBeCloseTo(22, 5);
    const lowerCav0 = Math.min(...cav0.map((h) => h.y));
    // Inferior (GAV_1): elev = 16,5; cavilha inferior em elev+15.
    expect(lowerCav0).toBeCloseTo(16.5 + 15, 5);

    const drill = buildDrillStationXmlFilesForProject(cutlist, {
      projectName: "STACK2",
      boxes: [box],
      rules: defaultRulesConfig,
    });
    expect(
      drill.filter((f) => f.partName.includes("gav_frent") && f.machineTarget === "drill").length
    ).toBeGreaterThanOrEqual(2);
  });

  it("generateDrawerGroup — inferior na base, superior na CIMA", () => {
    const boxH = 600;
    const group = generateDrawerGroup({
      boxWidth: 600,
      boxHeight: boxH,
      boxDepth: 560,
      boxThickness: 19,
      boxId: "flush-2",
      drawerCount: 2,
      drawerType: "normal",
      heightMode: "equal",
      availableDepths: settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      drawerSettings: settingsDefaults.gavetas,
      espessuraCostaMm: 10,
      costaAtiva: true,
    });
    const layers = drawerGroupToLayerItems(group);
    expect(resolveDrawerStackRole(0, 2)).toBe("lowest");
    expect(resolveDrawerStackRole(1, 2)).toBe("highest");

    const heights = layers.map((l) => l.height);
    const positions = layers.map((l) => l.posY!);
    const geo0 = resolveDrawerFrontStackGeometry({
      drawerIndex0Based: 0,
      drawerHeights: heights,
      boxInternalHeightMm: boxH,
      posYMm: positions[0]!,
    });
    const geo1 = resolveDrawerFrontStackGeometry({
      drawerIndex0Based: 1,
      drawerHeights: heights,
      boxInternalHeightMm: boxH,
      posYMm: positions[1]!,
    });
    expect(geo0.flushToModuleBase).toBe(true);
    expect(geo1.flushToModuleTop).toBe(true);
  });
});
