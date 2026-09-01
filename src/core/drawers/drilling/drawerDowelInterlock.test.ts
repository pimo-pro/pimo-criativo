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

describe("drawerDowelInterlock — profundidade e centro (golden)", () => {
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
    expect(assertDowelDoesNotThrough(30, 16)).toBe(false); // aresta vai ao longo do painel, não T
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

  it("Y aresta / frente — middle 15; lowest 54; H−35", () => {
    expect(getDrawerLateralEdgeDowelYPositionsMm(178)).toEqual([15, 143]);
    expect(getDrawerFrontDowelYPositionsMm(178)).toEqual([15, 143]);
    expect(getDrawerFrontDowelYPositionsMm(178, true)).toEqual([54, 143]);
    expect(DRAWER_LAT_EDGE_DOWEL_Y_FROM_TOP_MM).toBe(35);
  });

  it("laterais lowest: cavilhas de aresta 54 e H−35", () => {
    expect(getDrawerLateralEdgeDowelYPositionsMm(178, true)).toEqual([54, 143]);
    const latEsq = computeDrawerLateralStructuralHoles({
      largura: 500,
      altura: 178,
      espessura: 16,
      side: "esq",
      isLowestDrawer: true,
    });
    const latDir = computeDrawerLateralStructuralHoles({
      largura: 500,
      altura: 178,
      espessura: 16,
      side: "dir",
      isLowestDrawer: true,
    });
    const edgeEsq = latEsq.filter((h) => h.tipo === "cavilha" && !h.topDrillable);
    const edgeDir = latDir.filter((h) => h.tipo === "cavilha" && !h.topDrillable);
    expect(edgeEsq.map((h) => h.y).sort((a, b) => a - b)).toEqual([54, 143]);
    expect(edgeDir.map((h) => h.y).sort((a, b) => a - b)).toEqual([54, 143]);
    expect(edgeEsq).toHaveLength(2);
    expect(edgeDir).toHaveLength(2);
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
  const _FRENTE = { largura: 598, altura: 150, espessura };

  it("lateral: 2 face Depth13 + 2 aresta Depth30 + 2 rasgos", () => {
    const esq = computeDrawerLateralStructuralHoles({ ...LAT, side: "esq" });
    const face = esq.filter((h) => h.tipo === "cavilha" && h.topDrillable);
    const edge = esq.filter((h) => h.tipo === "cavilha" && !h.topDrillable);
    expect(face).toHaveLength(2);
    expect(edge).toHaveLength(2);
    expect(face.every((h) => h.profundidade === 13)).toBe(true);
    expect(edge.every((h) => h.profundidade === 30)).toBe(true);
    expect([...face, ...edge].every((h) => h.diametro === 10)).toBe(true);
    expect(face.every((h) => assertDowelDoesNotThrough(h.profundidade, espessura))).toBe(true);

    expect(face.map((h) => h.y).sort((a, b) => a - b)).toEqual([15, 112]);
    expect(edge.map((h) => h.y).sort((a, b) => a - b)).toEqual([15, 115]);
    expect(edge.every((h) => h.x === LAT.largura)).toBe(true);
  });

  it("espelho L/R: Y iguais, X invertidos", () => {
    const esq = computeDrawerLateralStructuralHoles({ ...LAT, side: "esq" });
    const dir = computeDrawerLateralStructuralHoles({ ...LAT, side: "dir" });
    expect(esq.map((h) => h.y)).toEqual(dir.map((h) => h.y));
    const esqEdge = esq.filter((h) => h.tipo === "cavilha" && !h.topDrillable);
    const dirEdge = dir.filter((h) => h.tipo === "cavilha" && !h.topDrillable);
    expect(esqEdge.every((h) => h.x === LAT.largura)).toBe(true);
    expect(dirEdge.every((h) => h.x === 0)).toBe(true);
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

  it("frente_int ≡ costa nas cavilhas laterais (Y=15/H−15, Depth 30)", () => {
    const costa = computeDrawerCostaStructuralHoles(COSTA);
    const frente = computeDrawerFrenteIntStructuralHoles({
      largura: COSTA.largura,
      altura: COSTA.altura,
      espessura: COSTA.espessura,
    });
    const costaCav = costa.filter((h) => h.tipo === "cavilha");
    expect(frente).toHaveLength(4);
    expect(frente.every((h) => h.tipo === "cavilha" && h.profundidade === 30)).toBe(true);
    expect([...new Set(frente.map((h) => h.y))].sort((a, b) => a - b)).toEqual(
      [...new Set(costaCav.map((h) => h.y))].sort((a, b) => a - b)
    );
  });
});

describe("frente_int — sem especialização GAV_1 / sem rasgo", () => {
  it("isLowestDrawer não altera Y (padrão costa simétrico)", () => {
    const holes = computeDrawerFrenteIntStructuralHoles({
      largura: 600,
      altura: 178,
      espessura: 16,
      isLowestDrawer: true,
      bottomThicknessMm: 10,
    });
    expect(holes).toHaveLength(4);
    const ys = [...new Set(holes.map((h) => h.y))].sort((a, b) => a - b);
    expect(ys).toEqual([15, 163]); // 178−15; não 54
    expect(holes.every((h) => h.holeSubtype !== "groove")).toBe(true);
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

  it("LAT_ESQ T16: Y face 15/112, Y aresta 15/115, Depth 13+30", () => {
    const xml = xmlFor("gaveta_lat_esq", { largura: 500, altura: 150, espessura: 16 });
    expect(xml).toContain("<Y1>15.00</Y1>");
    expect(xml).toContain("<Y1>112.00</Y1>");
    expect(xml).toContain("<Y1>115.00</Y1>");
    expect(xml).toContain("<Depth>13.00</Depth>");
    expect(xml).toContain("<Depth>30.00</Depth>");
    expect(xml).toContain("<X1>500.00</X1>");
  });

  it("LAT_ESQ T19: Depth aresta 30, face 13", () => {
    const xml = xmlFor("gaveta_lat_esq", { largura: 500, altura: 150, espessura: 19 });
    expect(xml).toContain("<Depth>30.00</Depth>");
    expect(xml).toContain("<Depth>13.00</Depth>");
  });

  it("COSTA H=127: Y=15/112, Depth=30", () => {
    const xml = xmlFor("gaveta_traseira", { largura: 468, altura: 127, espessura: 16 });
    expect(xml).toContain("<Y1>15.00</Y1>");
    expect(xml).toContain("<Y1>112.00</Y1>");
    expect(xml).toContain("<Depth>30.00</Depth>");
  });

  it("pipeline stack 3 — laterais/costa/frente com furos", () => {
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
        // Face: depth < T; aresta TypeNo=2 Depth 30 — ao longo do painel (não through-T)
        if (h.depth >= t) {
          expect(h.depth).toBe(30);
        } else {
          expect(h.depth).toBeLessThan(t);
        }
      }
    }
  });
});
