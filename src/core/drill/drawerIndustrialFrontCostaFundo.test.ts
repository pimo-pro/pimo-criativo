/**
 * Correcoes industriais gaveta: frente DRILL, costa × percentual Admin, fundo entradas.
 */
import { describe, expect, it } from "vitest";
import {
  computeDrawerCostaStructuralHoles,
  computeDrawerFrenteExtStructuralHoles,
  computeDrawerLateralStructuralHoles,
} from "../drawers/drilling/DrawerDrillingRules";
import {
  DRAWER_BOTTOM_FRONT_ENTRY_MM,
  DRAWER_BOTTOM_SIDE_ENTRY_MM,
  DRAWER_COSTA_HEIGHT_BELOW_LATERAL_MM,
  DRAWER_SIDE_BASE_ELEVATION_MM,
} from "../drawers/drawerGeometryConstants";
import { createDrawer } from "../drawers/Drawer";
import { calculateDrawerSpecs } from "../drawers/DrawerParametrics";
import {
  resolveDrawerBackCenterZMm,
  resolveDrawerBottomCenterZFrontEntryMm,
} from "../drawers/drawerViewerLayout";
import { resolveDrawerSideDepthMm } from "../drawers/drawerSlideDepth";
import { settingsDefaults } from "../settings/settingsSchema";
import { cutlistComPrecoFromBox } from "../manufacturing/cutlistFromBoxes";
import { defaultRulesConfig } from "../rules/rulesConfig";
import { isDrawerPieceTipo } from "../../services/drawerCutlistAdapter";
import { buildDrillStationXmlFilesForProject, resolveXmlMachineTarget } from "./drillExport";
import {
  buildDrawerScenario,
  minimalBoxWithDrawers,
} from "../../validation/drawerCertificationTestHelpers";

describe("gaveta industrial — frente DRILL / costa percentual / fundo entradas", () => {
  it("routing: gav_frente* ? DRILL (nunca CNC)", () => {
    expect(resolveXmlMachineTarget("gaveta_frente")).toBe("drill");
    expect(resolveXmlMachineTarget("gaveta_frente_int")).toBe("drill");
    expect(resolveXmlMachineTarget("gaveta_frente_ext")).toBe("drill");
    expect(resolveXmlMachineTarget("cima")).toBe("cnc");
    expect(resolveXmlMachineTarget("gaveta_lat_esq")).toBe("drill");
  });

  it("SSOT: costa = laterais − 23; fundo = vão+laterais / sideDepth+10", () => {
    const specs = calculateDrawerSpecs(
      {
        boxInternalWidth: 1046,
        boxInternalHeight: 720,
        boxInternalDepth: 560,
        boxThickness: 19,
        drawerHeight: 200,
        stackRole: "single",
      },
      settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      {
        ...settingsDefaults.gavetas,
        gavetaEspessuraLateralMm: 16,
        gavetaEspessuraTraseiraMm: 16,
        gavetaEspessuraFundoMm: 10,
        gavetaTipoCaixaMetalica: "Nenhuma",
      }
    );
    const sideH = specs.leftSide.height;
    expect(specs.back.height).toBeCloseTo(sideH - DRAWER_COSTA_HEIGHT_BELOW_LATERAL_MM, 5);
    const internalW = specs.back.width;
    const sideDepth = resolveDrawerSideDepthMm(specs.body.depth);
    expect(specs.bottom.width).toBe(
      internalW + DRAWER_BOTTOM_SIDE_ENTRY_MM + DRAWER_BOTTOM_SIDE_ENTRY_MM
    );
    expect(specs.bottom.height).toBe(sideDepth + DRAWER_BOTTOM_FRONT_ENTRY_MM);
    expect(specs.gaps.bottomSlots).toEqual({
      front: 10,
      sides: 9,
      back: 16,
    });
  });

  it("exemplo industrial: vão 1000, bodyDepth 500, costa 16 → fundo 1018×500", () => {
    // backWidth = boxInternal - 2*folgaLateral(7) - 2*sideT(16) = 1046 - 14 - 32 = 1000
    // sideDepth = 500 - 10 = 490; width = 1000+18; depth = 490+10
    const specs = calculateDrawerSpecs(
      {
        boxInternalWidth: 1046,
        boxInternalHeight: 720,
        boxInternalDepth: 500,
        boxThickness: 19,
        drawerHeight: 200,
        stackRole: "single",
      },
      settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      {
        gavetaEspessuraLateralMm: 16,
        gavetaEspessuraTraseiraMm: 16,
        gavetaEspessuraFundoMm: 10,
        gavetaTipoCaixaMetalica: "Nenhuma",
        gavetaValidarProfundidadeCompativel: false,
      },
      { nominalDepthMm: 500 }
    );
    expect(specs.back.width).toBe(1000);
    expect(specs.bottom.width).toBe(1018);
    expect(specs.bottom.height).toBe(500);
    expect(specs.back.height).toBeCloseTo(
      specs.leftSide.height - DRAWER_COSTA_HEIGHT_BELOW_LATERAL_MM,
      5
    );
  });

  it("caso 550×500 (T=19, laterais/costa 16): gav_fundo = 484×450", () => {
    // L int 512; bodyWidth 498; vão 466; slide 450; sideDepth 440
    // width 466+18=484; depth 440+10=450
    const specs = calculateDrawerSpecs(
      {
        boxInternalWidth: 550 - 2 * 19,
        boxInternalHeight: 720,
        boxInternalDepth: 450,
        boxThickness: 19,
        drawerHeight: 200,
      },
      settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      {
        gavetaEspessuraLateralMm: 16,
        gavetaEspessuraTraseiraMm: 16,
        gavetaEspessuraFundoMm: 10,
        gavetaTipoCaixaMetalica: "Nenhuma",
        gavetaValidarProfundidadeCompativel: false,
        gavetaFolgaLateralMm: 7,
      },
      { nominalDepthMm: 450 }
    );
    expect(specs.back.width).toBe(466);
    expect(specs.leftSide.depth).toBe(440);
    expect(specs.bottom.width).toBe(484);
    expect(specs.bottom.height).toBe(450);
    expect(specs.bottom.thickness).toBe(10);

    // Pipeline: layer/cutlist herdam as mesmas dims (Viewer + industrial)
    expect(specs.gaps.bottomSlots).toEqual({ front: 10, sides: 9, back: 16 });
    expect(specs.bottom.width).toBe(specs.back.width + 18);
    expect(specs.bottom.height).toBe(specs.leftSide.depth + 10);
  });

  it("createDrawer: traseira gav_fun flush com traseira gav_cost (âncora frente + sideDepth+10)", () => {
    const specs = calculateDrawerSpecs(
      {
        boxInternalWidth: 550 - 2 * 19,
        boxInternalHeight: 720,
        boxInternalDepth: 450,
        boxThickness: 19,
        drawerHeight: 200,
      },
      settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      {
        gavetaEspessuraLateralMm: 16,
        gavetaEspessuraTraseiraMm: 16,
        gavetaEspessuraFundoMm: 10,
        gavetaTipoCaixaMetalica: "Nenhuma",
        gavetaValidarProfundidadeCompativel: false,
        gavetaFolgaLateralMm: 7,
      },
      { nominalDepthMm: 450 }
    );
    const drawer = createDrawer("flush-test", "box-1", specs, { x: 0, y: 0, z: 0 });
    const frontT = specs.frontExt.thickness;
    const sideDepth = specs.leftSide.depth;
    const bottomDepth = specs.bottom.height;
    expect(bottomDepth).toBe(sideDepth + DRAWER_BOTTOM_FRONT_ENTRY_MM);

    const bottomRearZ =
      drawer.pieces.bottom.positionZ - drawer.pieces.bottom.depth / 2;
    const costaRearZ =
      drawer.pieces.back.positionZ - drawer.pieces.back.depth / 2;
    expect(bottomRearZ).toBeCloseTo(costaRearZ, 5);

    const expectedCenterZ = resolveDrawerBottomCenterZFrontEntryMm(frontT, bottomDepth);
    expect(drawer.pieces.bottom.positionZ).toBeCloseTo(expectedCenterZ, 5);

    const costaCenterZ = resolveDrawerBackCenterZMm(frontT, sideDepth, specs.back.thickness);
    expect(drawer.pieces.back.positionZ).toBeCloseTo(costaCenterZ, 5);
  });

  it("frente_ext (highest): cavilhas sync Y aresta laterais + elev; rasgo fundo+1", () => {
    const sideH = 150;
    const frontH = 200;
    const holes = computeDrawerFrenteExtStructuralHoles({
      largura: 598,
      altura: frontH,
      espessura: 19,
      stackRole: "highest",
      isLowestDrawer: false,
      sideHeightMm: sideH,
      bodyWidthMm: 521,
      sideThicknessMm: 16,
      bottomThicknessMm: 10,
      sideBaseElevationMm: DRAWER_SIDE_BASE_ELEVATION_MM,
    });
    const cavilhas = holes.filter((h) => h.tipo === "cavilha");
    expect(cavilhas).toHaveLength(4);
    expect(cavilhas.every((h) => h.face === "tras" && h.profundidade === 13)).toBe(true);
    const lat = computeDrawerLateralStructuralHoles({
      largura: 521,
      altura: sideH,
      espessura: 16,
      side: "esq",
    });
    // Golden: aresta laterais (TypeNo=2) = interlock frente; face=tras em LAT_ESQ
    const latEdgeYs = lat
      .filter((h) => h.tipo === "cavilha" && !h.topDrillable)
      .map((h) => h.y)
      .sort((a, b) => a - b);
    const frontYs = [...new Set(cavilhas.map((h) => h.y))].sort((a, b) => a - b);
    expect(frontYs).toEqual(latEdgeYs.map((y) => y + DRAWER_SIDE_BASE_ELEVATION_MM));

    const groove = holes.find((h) => h.holeSubtype === "groove");
    expect(groove?.profundidade).toBe(11);
    expect(groove?.grooveWidth).toBe(11);
    expect(groove?.y).toBe(DRAWER_SIDE_BASE_ELEVATION_MM + sideH - 13);
  });

  it("costa: altura lat×factor único; Y golden 15 / H−15", () => {
    const sideH = 150;
    const costaH = sideH * (1 - settingsDefaults.gavetas.gavetaReducaoPercentual / 100);
    expect(costaH).toBeCloseTo(112.5, 5);
    const costa = computeDrawerCostaStructuralHoles({
      largura: 489,
      altura: costaH,
      espessura: 16,
      lateralAlturaMm: sideH,
    });
    const costaYs = [...new Set(costa.filter((h) => h.tipo === "cavilha").map((h) => h.y))].sort(
      (a, b) => a - b
    );
    expect(costaYs[0]).toBe(15);
    expect(costaYs[1]).toBeCloseTo(costaH - 15, 5);
    expect(costa.filter((h) => h.tipo === "cavilha").every((h) => h.profundidade === 30)).toBe(true);
    const bottoms = costa.filter((h) => h.face === "cima");
    expect(bottoms).toHaveLength(2);
    expect(bottoms.every((h) => h.diametro === 10 && h.profundidade === 10 && h.y === costaH)).toBe(
      true
    );
  });

  it("pipeline cutlist: frente_ext gera XML DRILL com cavilhas + rasgo", () => {
    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: 600,
      boxDepth: 560,
      drawerCount: 1,
    });
    const box = minimalBoxWithDrawers(layers);
    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig).filter((p) =>
      isDrawerPieceTipo(p.tipo)
    );
    const front = cutlist.find((p) => p.tipo === "gaveta_frente_ext");
    const lat = cutlist.find((p) => p.tipo === "gaveta_lat_esq");
    const costa = cutlist.find((p) => p.tipo === "gaveta_traseira");
    const fundo = cutlist.find((p) => p.tipo === "gaveta_fundo");

    expect(front?.drillHoles?.some((h) => h.holeType === "cavilha")).toBe(true);
    expect(front?.drillHoles?.some((h) => h.holeSubtype === "groove")).toBe(true);
    const groove = front!.drillHoles!.find((h) => h.holeSubtype === "groove")!;
    expect(groove.depth).toBe((fundo?.espessura ?? 10) + 1);

    expect(costa!.dimensoes.altura).toBeCloseTo(
      (lat?.dimensoes.altura ?? 0) - DRAWER_COSTA_HEIGHT_BELOW_LATERAL_MM,
      5
    );

    const drill = buildDrillStationXmlFilesForProject(cutlist, {
      projectName: "EVID_GAV",
      boxes: [box],
      rules: defaultRulesConfig,
    });
    const frontXml = drill.find((f) => f.partName.includes("gav_frent"));
    expect(frontXml).toBeDefined();
    expect(frontXml!.machineTarget).toBe("drill");
    expect(frontXml!.zipPath).toContain("drill/XML/");
    expect(frontXml!.filenameBase).toMatch(/_DRILL$/);
    expect(frontXml!.xml).toContain("<TypeNo>3</TypeNo>");
    expect(frontXml!.xml).toContain(`<Depth>${((fundo?.espessura ?? 10) + 1).toFixed(2)}</Depth>`);
    expect(frontXml!.xml).toContain("<Diameter>10.00</Diameter>");
  });
});
