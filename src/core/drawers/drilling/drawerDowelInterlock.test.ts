import { describe, expect, it } from "vitest";
import {
  assertDowelDoesNotThrough,
  clampDrawerEdgeDowelDepthMm,
  clampDrawerFaceDowelDepthMm,
  DRAWER_DOWEL_EDGE_DEPTH_MM,
  DRAWER_LAT_DOWEL_Y_FROM_BOTTOM_MM,
  DRAWER_LAT_EDGE_DOWEL_Y_FROM_TOP_MM,
  DRAWER_LAT_FACE_DOWEL_Y_FROM_TOP_MM,
  drawerThicknessCenterMm,
  getDrawerCostaDowelYPositionsMm,
  getDrawerFrontDowelYPositionsMm,
  getDrawerLateralEdgeDowelYPositionsMm,
  getDrawerLateralFaceDowelYPositionsMm,
  getDrawerRearDowelYPositionsMm,
} from "./drawerDowelInterlock";
import {
  computeDrawerCostaStructuralHoles,
  computeDrawerFrenteIntStructuralHoles,
  computeDrawerLateralStructuralHoles,
} from "./DrawerDrillingRules";
import { buildPanelDrillingResult } from "../../../modules/drilling/drillingAdapter";
import { defaultRulesConfig } from "../../rules/rulesConfig";
import { buildDrillFilesForProject } from "../../drill/drillExport";
import type { CutListItemComPreco } from "../../types";
import {
  buildDrawerScenario,
  minimalBoxWithDrawers,
} from "../../../validation/drawerCertificationTestHelpers";
import { cutlistComPrecoFromBox } from "../../manufacturing/cutlistFromBoxes";
import { isDrawerPieceTipo } from "../../../services/drawerCutlistAdapter";

describe("drawerDowelInterlock  profundidade e centro (golden)", () => {
  it("clamp aresta legado: 16?14, 19?17 (export usa Depth 30 fixed)", () => {
    expect(clampDrawerEdgeDowelDepthMm(16)).toBe(14);
    expect(clampDrawerEdgeDowelDepthMm(19)).toBe(17);
    expect(clampDrawerEdgeDowelDepthMm(32)).toBe(30);
    expect(DRAWER_DOWEL_EDGE_DEPTH_MM).toBe(30);
  });

  it("face 13 mm sem atravessar", () => {
    expect(clampDrawerFaceDowelDepthMm(16)).toBe(13);
    expect(clampDrawerFaceDowelDepthMm(19)).toBe(13);
    expect(clampDrawerFaceDowelDepthMm(10)).toBe(9);
    expect(assertDowelDoesNotThrough(13, 16)).toBe(true);
    expect(assertDowelDoesNotThrough(30, 16)).toBe(false); // aresta vai ao longo do painel, no T
  });

  it("centro espessura = T/2", () => {
    expect(drawerThicknessCenterMm(16)).toBe(8);
    expect(drawerThicknessCenterMm(19)).toBe(9.5);
  });

  it("Y face laterais = 15 e H?38", () => {
    expect(getDrawerLateralFaceDowelYPositionsMm(150)).toEqual([15, 112]);
    expect(getDrawerRearDowelYPositionsMm(150)).toEqual([15, 112]);
    expect(DRAWER_LAT_FACE_DOWEL_Y_FROM_TOP_MM).toBe(38);
    expect(DRAWER_LAT_DOWEL_Y_FROM_BOTTOM_MM).toBe(15);
  });

  it("Y aresta / frente = 15 e H?35", () => {
    expect(getDrawerLateralEdgeDowelYPositionsMm(178)).toEqual([15, 143]);
    expect(getDrawerFrontDowelYPositionsMm(178)).toEqual([15, 143]);
    expect(getDrawerFrontDowelYPositionsMm(178, true)).toEqual([15, 143]);
    expect(DRAWER_LAT_EDGE_DOWEL_Y_FROM_TOP_MM).toBe(35);
  });

  it("Y costa = 15 e H?15", () => {
    expect(getDrawerCostaDowelYPositionsMm(172.5)).toEqual([15, 157.5]);
  });
});

describe.each([
  { espessura: 16, center: 8 },
  { espessura: 19, center: 9.5 },
] as const)("interlock gaveta T=$espessura (golden)", ({ espessura, center }) => {
  const LAT = { largura: 500, altura: 150, espessura };
  const COSTA = { largura: 468, altura: 127, espessura }; // lat ? 23
  const FRENTE = { largura: 598, altura: 150, espessura };

  it("lateral: 4 cavilhas TypeNo2 Y=60 + grelha 5; sem face/rasgos", () => {
    const esq = computeDrawerLateralStructuralHoles({ ...LAT, side: "esq" });
    const cavilhas = esq.filter((h) => h.tipo === "cavilha");
    expect(cavilhas).toHaveLength(4);
    expect(cavilhas.every((h) => h.profundidade === 30 && h.diametro === 10)).toBe(true);
    expect(cavilhas.map((h) => h.y).sort((a, b) => a - b)).toEqual([60, 60, 440, 440]);
    expect([...new Set(cavilhas.map((h) => h.x))].sort((a, b) => a - b)).toEqual([0, LAT.altura]);
    expect(esq.filter((h) => h.tipo === "corredica").length).toBe(15);
    expect(esq.filter((h) => h.holeSubtype === "groove")).toHaveLength(0);
    void center;
  });

  it("espelho L/R: cavilhas iguais; grelha X espelhada", () => {
    const esq = computeDrawerLateralStructuralHoles({ ...LAT, side: "esq" });
    const dir = computeDrawerLateralStructuralHoles({ ...LAT, side: "dir" });
    expect(
      esq
        .filter((h) => h.tipo === "cavilha")
        .map((h) => [h.x, h.y])
        .sort()
    ).toEqual(
      dir
        .filter((h) => h.tipo === "cavilha")
        .map((h) => [h.x, h.y])
        .sort()
    );
    const L = LAT.altura;
    const esqX = [
      ...new Set(esq.filter((h) => h.tipo === "corredica").map((h) => h.x)),
    ].sort((a, b) => a - b);
    const dirX = [
      ...new Set(dir.filter((h) => h.tipo === "corredica").map((h) => h.x)),
    ].sort((a, b) => a - b);
    expect(esqX).toEqual(dirX.map((x) => Number((L - x).toFixed(2))).sort((a, b) => a - b));
  });

  it("costa: Y=15/H-15 Depth 30", () => {
    const costa = computeDrawerCostaStructuralHoles(COSTA);
    const costaY = [
      ...new Set(costa.filter((h) => h.tipo === "cavilha").map((h) => h.y)),
    ].sort((a, b) => a - b);
    expect(costaY).toEqual([15, 112]);
    expect(costa.filter((h) => h.tipo === "cavilha").every((h) => h.profundidade === 30)).toBe(
      true
    );
    void center;
  });

  it("frente ? lateral aresta: frente usa tabela 15/H-35 (laterais Y=60 transversal)", () => {
    const frente = computeDrawerFrenteIntStructuralHoles(FRENTE);
    const frenteY = [...new Set(frente.map((h) => h.y))].sort((a, b) => a - b);
    expect(frenteY).toEqual(getDrawerLateralEdgeDowelYPositionsMm(FRENTE.altura));
    expect(frente.every((h) => h.profundidade === 13 && h.tipo === "cavilha")).toBe(true);
  });
});

describe("stack  Y frontais golden (isLowest ignorado)", () => {
  it("mesma tabela 15 / H?35 com ou sem isLowestDrawer", () => {
    const holes = computeDrawerFrenteIntStructuralHoles({
      largura: 600,
      altura: 178,
      espessura: 16,
      isLowestDrawer: true,
    });
    const ys = [...new Set(holes.map((h) => h.y))].sort((a, b) => a - b);
    expect(ys).toEqual([15, 143]);
  });
});

describe("XML / DRILL alinhado com coordenadas golden", () => {
  function xmlFor(tipo: string, dims: { largura: number; altura: number; espessura: number }) {
    const drilling = buildPanelDrillingResult(
      {
        tipo,
        larguraMm: dims.largura,
        alturaMm: dims.altura,
        espessuraMm: dims.espessura,
      },
      defaultRulesConfig
    );
    expect(drilling.success).toBe(true);
    const item: CutListItemComPreco = {
      id: `${tipo}-xml`,
      nome: tipo,
      tipo,
      quantidade: 1,
      dimensoes: {
        largura: dims.largura,
        altura: dims.altura,
        profundidade: dims.espessura,
      },
      espessura: dims.espessura,
      material: "mdf_branco",
      drillHoles: drilling.data!.drillHoles,
      precoUnitario: 0,
      precoTotal: 0,
    };
    return buildDrillFilesForProject([item], {
      projectName: "DowelInterlock",
      boxes: [],
      rules: defaultRulesConfig,
    })[0]!.xml;
  }

  it("LAT_ESQ T16: cavilhas Y=60/W-60 Depth 30; grelha Ø5", () => {
    const xml = xmlFor("gaveta_lat_esq", { largura: 500, altura: 150, espessura: 16 });
    expect(xml).toContain("<PanelLength>150.00</PanelLength>");
    expect(xml).toContain("<PanelWidth>500.00</PanelWidth>");
    expect(xml).toContain("<Y1>60.00</Y1>");
    expect(xml).toContain("<Y1>440.00</Y1>");
    expect(xml).toContain("<Depth>30.00</Depth>");
    expect(xml).toContain("<Diameter>5.00</Diameter>");
    expect(xml).toContain("<X1>0.00</X1>");
    expect(xml).toContain("<X1>150.00</X1>");
    expect(xml).not.toContain("<Depth>13.00</Depth>");
  });

  it("LAT_ESQ T19: Depth aresta 30; grelha mark 1", () => {
    const xml = xmlFor("gaveta_lat_esq", { largura: 500, altura: 150, espessura: 19 });
    expect(xml).toContain("<Depth>30.00</Depth>");
    expect(xml).toContain("<Depth>1.00</Depth>");
  });

  it("COSTA H=127: Y=15/112, Depth=30", () => {
    const xml = xmlFor("gaveta_traseira", { largura: 468, altura: 127, espessura: 16 });
    expect(xml).toContain("<Y1>15.00</Y1>");
    expect(xml).toContain("<Y1>112.00</Y1>");
    expect(xml).toContain("<Depth>30.00</Depth>");
  });

  it("pipeline stack 3  laterais/costa/frente com furos", () => {
    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: 720,
      boxDepth: 560,
      drawerCount: 3,
    });
    const box = minimalBoxWithDrawers(layers);
    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig).filter((p) =>
      isDrawerPieceTipo(p.tipo)
    );
    expect(cutlist.length).toBeGreaterThanOrEqual(9);

    const structuralTipos = [
      "gaveta_lat_esq",
      "gaveta_lat_dir",
      "gaveta_traseira",
      "gaveta_frente",
      "gaveta_frente_int",
    ];
    for (const tipo of structuralTipos) {
      const sample = cutlist.find((p) => p.tipo === tipo) ?? {
        tipo,
        dimensoes: { largura: 500, altura: 150, profundidade: 16 },
        espessura: 16,
      };
      const rebuilt = buildPanelDrillingResult(
        {
          tipo: sample.tipo,
          larguraMm: sample.dimensoes?.largura ?? 500,
          alturaMm: sample.dimensoes?.altura ?? 150,
          espessuraMm: sample.espessura ?? sample.dimensoes?.profundidade ?? 16,
        },
        defaultRulesConfig
      );
      expect(rebuilt.success).toBe(true);
      expect((rebuilt.data?.drillHoles.length ?? 0) > 0).toBe(true);
      const t = sample.espessura ?? 16;
      for (const h of rebuilt.data?.drillHoles ?? []) {
        if (h.holeSubtype === "groove") continue;
        // Face: depth < T; aresta TypeNo=2 Depth 30  ao longo do painel (no through-T)
        if (h.depth >= t) {
          expect(h.depth).toBe(30);
        } else {
          expect(h.depth).toBeLessThan(t);
        }
      }
    }
  });
});
