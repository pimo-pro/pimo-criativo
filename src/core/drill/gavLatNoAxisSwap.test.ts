/**
 * gav_lat_* — SSOT transversal cx gav lat.
 * Cutlist: largura=profundidade, altura=altura.
 * Nesting/XML: L=altura, W=profundidade; furos no referencial L×W.
 */
import { describe, expect, it } from "vitest";
import { cutlistToPieces } from "../cutlayout/cutLayoutEngine";
import { buildDrillStationXmlFilesForProject } from "./drillExport";
import { defaultRulesConfig } from "../rules/rulesConfig";
import type { CutListItemComPreco, PanelDrillHole } from "../types";

/** Furos já no referencial transversal (L=altura=400, W=profundidade=250). */
const HOLES: PanelDrillHole[] = [
  { x: 0, y: 60, diameter: 10, depth: 30, holeType: "cavilha" },
  { x: 0, y: 190, diameter: 10, depth: 30, holeType: "cavilha" },
  { x: 400, y: 60, diameter: 10, depth: 30, holeType: "cavilha" },
  { x: 400, y: 190, diameter: 10, depth: 30, holeType: "cavilha" },
];

function tallGavLat(tipo: "gaveta_lat_esq" | "gaveta_lat_dir"): CutListItemComPreco {
  return {
    id: tipo,
    nome: tipo,
    tipo,
    quantidade: 1,
    dimensoes: { largura: 250, altura: 400, profundidade: 16 },
    espessura: 16,
    material: "mdf",
    boxId: "b1",
    drillHoles: HOLES,
    precoUnitario: 0,
    precoTotal: 0,
    metadata: { qrCode: `${tipo}-1` },
  };
}

describe("gav_lat — SSOT transversal (CNC nesting + XML DRILL)", () => {
  it.each(["gaveta_lat_esq", "gaveta_lat_dir"] as const)(
    "%s cutlistToPieces: L=altura W=profundidade; furos sem remap",
    (tipo) => {
      const pieces = cutlistToPieces([tallGavLat(tipo)]);
      expect(pieces).toHaveLength(1);
      expect(pieces[0]!.largura_mm).toBe(400);
      expect(pieces[0]!.altura_mm).toBe(250);
      const xs = (pieces[0]!.drillHoles ?? []).map((h) => h.x).sort((a, b) => a - b);
      const ys = (pieces[0]!.drillHoles ?? []).map((h) => h.y).sort((a, b) => a - b);
      expect(xs).toEqual([0, 0, 400, 400]);
      expect(ys).toEqual([60, 60, 190, 190]);
    }
  );

  it("XML DRILL: L=altura W=largura; X1/Y1 = drillHoles sem remap", () => {
    const item = tallGavLat("gaveta_lat_dir");
    const files = buildDrillStationXmlFilesForProject([item], {
      projectName: "T",
      boxes: [],
      rules: defaultRulesConfig,
    });
    expect(files).toHaveLength(1);
    const xml = files[0]!.xml;
    expect(xml).toContain("<PanelLength>400.00</PanelLength>");
    expect(xml).toContain("<PanelWidth>250.00</PanelWidth>");
    expect(xml).toContain("<X1>0.00</X1>");
    expect(xml).toContain("<X1>400.00</X1>");
    expect(xml).toContain("<Y1>60.00</Y1>");
    expect(xml).toContain("<Y1>190.00</Y1>");
  });

  it("outras peças (módulo lateral) ainda podem usar sort/swap — não regressão", () => {
    const mod: CutListItemComPreco = {
      id: "mod",
      nome: "lat",
      tipo: "lateral_direita",
      quantidade: 1,
      dimensoes: { largura: 300, altura: 800, profundidade: 19 },
      espessura: 19,
      material: "mdf",
      boxId: "b1",
      drillHoles: [{ x: 60, y: 200, diameter: 5, depth: 13, holeType: "prateleira", topDrillable: true }],
      precoUnitario: 0,
      precoTotal: 0,
    };
    const pieces = cutlistToPieces([mod]);
    expect(pieces[0]!.largura_mm).toBe(800);
    expect(pieces[0]!.altura_mm).toBe(300);
    expect(pieces[0]!.drillHoles?.[0]?.x).toBe(200);
    expect(pieces[0]!.drillHoles?.[0]?.y).toBe(300 - 60);
  });
});
