/**
 * Correcoes industriais gaveta: frente DRILL, costa -23, fundo entradas.
 */
import { describe, expect, it } from "vitest";
import {
  computeDrawerCostaStructuralHoles,
  computeDrawerFrenteExtStructuralHoles,
} from "../drawers/drilling/DrawerDrillingRules";
import { getDrawerLateralEdgeDowelYPositionsMm } from "../drawers/drilling/drawerDowelInterlock";
import {
  DRAWER_BOTTOM_FRONT_ENTRY_MM,
  DRAWER_BOTTOM_SIDE_ENTRY_MM,
  DRAWER_COSTA_HEIGHT_BELOW_LATERAL_MM,
  DRAWER_SIDE_BASE_ELEVATION_MM,
} from "../drawers/drawerGeometryConstants";
import { calculateDrawerSpecs } from "../drawers/DrawerParametrics";
import { settingsDefaults } from "../settings/settingsSchema";
import { cutlistComPrecoFromBox } from "../manufacturing/cutlistFromBoxes";
import { defaultRulesConfig } from "../rules/rulesConfig";
import { isDrawerPieceTipo } from "../../services/drawerCutlistAdapter";
import { buildDrillStationXmlFilesForProject, resolveXmlMachineTarget } from "./drillExport";
import {
  buildDrawerScenario,
  minimalBoxWithDrawers,
} from "../../validation/drawerCertificationTestHelpers";

describe("gaveta industrial  frente DRILL / costa -23 / fundo entradas", () => {
  it("routing: gav_frente* ? DRILL (nunca CNC)", () => {
    expect(resolveXmlMachineTarget("gaveta_frente")).toBe("drill");
    expect(resolveXmlMachineTarget("gaveta_frente_int")).toBe("drill");
    expect(resolveXmlMachineTarget("gaveta_frente_ext")).toBe("drill");
    expect(resolveXmlMachineTarget("cima")).toBe("cnc");
    expect(resolveXmlMachineTarget("gaveta_lat_esq")).toBe("drill");
  });

  it("SSOT: costa = laterais - 23; fundo = interna + entradas", () => {
    const specs = calculateDrawerSpecs(
      {
        boxInternalWidth: 1046,
        boxInternalHeight: 720,
        boxInternalDepth: 560,
        boxThickness: 19,
        drawerHeight: 200,
      },
      settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      {
        gavetaEspessuraLateralMm: 16,
        gavetaEspessuraTraseiraMm: 16,
        gavetaEspessuraFundoMm: 10,
        gavetaTipoCaixaMetalica: "Nenhuma",
      }
    );
    const sideH = specs.leftSide.height;
    expect(specs.back.height).toBe(sideH - DRAWER_COSTA_HEIGHT_BELOW_LATERAL_MM);
    const internalW = specs.back.width;
    expect(specs.bottom.width).toBe(internalW + DRAWER_BOTTOM_FRONT_ENTRY_MM + 16);
    expect(specs.bottom.height).toBe(
      specs.body.depth + DRAWER_BOTTOM_SIDE_ENTRY_MM + DRAWER_BOTTOM_SIDE_ENTRY_MM
    );
    expect(specs.gaps.bottomSlots).toEqual({
      front: 10,
      sides: 10,
      back: 16,
    });
  });

  it("exemplo industrial: interna 1000x500, costa 16 ? fundo 1026x520", () => {
    // backWidth = boxInternal - 2*folgaLateral(7) - 2*sideT(16) = 1046 - 14 - 32 = 1000
    const specs = calculateDrawerSpecs(
      {
        boxInternalWidth: 1046,
        boxInternalHeight: 720,
        boxInternalDepth: 500,
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
      },
      { nominalDepthMm: 500 }
    );
    expect(specs.back.width).toBe(1000);
    expect(specs.bottom.width).toBe(1026);
    expect(specs.bottom.height).toBe(520);
    expect(specs.back.height).toBe(specs.leftSide.height - 23);
  });

  it("frente_ext (highest): cavilhas sync tabela aresta 15/H-35 + elev; rasgo fundo+1", () => {
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
    // Frente mantm tabela legado 15/H?35 (interlock); laterais usam Y=60 transversal.
    const edgeYs = getDrawerLateralEdgeDowelYPositionsMm(sideH);
    const frontYs = [...new Set(cavilhas.map((h) => h.y))].sort((a, b) => a - b);
    expect(frontYs).toEqual(edgeYs.map((y) => y + DRAWER_SIDE_BASE_ELEVATION_MM));

    const groove = holes.find((h) => h.holeSubtype === "groove");
    expect(groove?.profundidade).toBe(11);
    expect(groove?.y).toBe(DRAWER_SIDE_BASE_ELEVATION_MM + sideH - 13);
  });

  it("costa: altura lat?23; Y golden 15 / H?15 (no latY?23)", () => {
    const sideH = 150;
    const costaH = sideH - DRAWER_COSTA_HEIGHT_BELOW_LATERAL_MM;
    expect(costaH).toBe(127);
    const costa = computeDrawerCostaStructuralHoles({
      largura: 489,
      altura: costaH,
      espessura: 16,
      lateralAlturaMm: sideH,
    });
    const costaYs = [...new Set(costa.filter((h) => h.tipo === "cavilha").map((h) => h.y))].sort(
      (a, b) => a - b
    );
    expect(costaYs).toEqual([15, costaH - 15]);
    expect(costa.filter((h) => h.tipo === "cavilha").every((h) => h.profundidade === 30)).toBe(true);
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

    expect(costa!.dimensoes.altura).toBe(
      (lat?.dimensoes.altura ?? 0) - DRAWER_COSTA_HEIGHT_BELOW_LATERAL_MM
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
