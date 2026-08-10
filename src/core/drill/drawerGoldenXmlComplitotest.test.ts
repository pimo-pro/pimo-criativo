/**
 * Golden reference — GAVETA 1/XML_COMPLITO (apenas DRILL).
 */
import { describe, expect, it } from "vitest";
import { buildDrillStationXmlFilesForProject } from "./drillExport";
import { buildPanelDrillingResult } from "../../modules/drilling/drillingAdapter";
import { defaultRulesConfig } from "../rules/rulesConfig";
import type { CutListItemComPreco } from "../types";
import { withIndustrialOutputAuthorization } from "../industrial/industrialOutputGuard";
import {
  computeDrawerCostaStructuralHoles,
  computeDrawerLateralStructuralHoles,
  computeDrawerLowestFrenteExtFixedHoles,
} from "../drawers/drilling/DrawerDrillingRules";
import { settingsDefaults } from "../settings/settingsSchema";

function xmlFor(
  tipo: CutListItemComPreco["tipo"],
  dims: { largura: number; altura: number; espessura: number },
  extra?: Record<string, unknown>
): string {
  return withIndustrialOutputAuthorization("all", () => {
    const drilling = buildPanelDrillingResult(
      {
        tipo,
        larguraMm: dims.largura,
        alturaMm: dims.altura,
        espessuraMm: dims.espessura,
        ...extra,
      } as never,
      defaultRulesConfig
    );
    expect(drilling.success).toBe(true);
    const item: CutListItemComPreco = {
      id: `g-${tipo}`,
      nome: String(tipo),
      tipo,
      quantidade: 1,
      dimensoes: {
        largura: dims.largura,
        altura: dims.altura,
        profundidade: dims.espessura,
      },
      espessura: dims.espessura,
      material: "mdf",
      drillHoles: drilling.data!.drillHoles,
      precoUnitario: 0,
      precoTotal: 0,
      metadata: extra?.metadata as never,
    };
    const files = buildDrillStationXmlFilesForProject([item], {
      projectName: "GOLDEN",
      boxes: [],
      rules: defaultRulesConfig,
    });
    return files[0]?.xml ?? "";
  });
}

describe("golden XML_COMPLITO — laterais", () => {
  const L = 540;
  const W = 195.5;
  const T = 16;

  it("LAT_DIR — TypeNo1 face + TypeNo2 aresta + 2 rasgos", () => {
    const holes = computeDrawerLateralStructuralHoles({
      largura: L,
      altura: W,
      espessura: T,
      side: "dir",
    });
    expect(holes.filter((h) => h.topDrillable).map((h) => [h.x, h.y])).toEqual([
      [L - T / 2, 15],
      [L - T / 2, W - 38],
    ]);
    expect(
      holes.filter((h) => h.tipo === "cavilha" && !h.topDrillable).map((h) => [h.x, h.y, h.profundidade])
    ).toEqual([
      [0, 15, 30],
      [0, W - 35, 30],
    ]);
    const grooves = holes.filter((h) => h.holeSubtype === "groove");
    expect(grooves).toHaveLength(2);
    expect(grooves.map((g) => [g.y, g.grooveWidth, g.profundidade])).toEqual([
      [W - 13, 13, 3],
      [W - 23, 11, 10],
    ]);

    const xml = xmlFor("gaveta_lat_dir", { largura: L, altura: W, espessura: T });
    expect(xml).toContain("<PanelLength>540.00</PanelLength>");
    expect(xml).toContain("<PanelWidth>195.50</PanelWidth>");
    expect(xml).toContain("<TypeNo>1</TypeNo>");
    expect(xml).toContain("<Y1>15.00</Y1>");
    expect(xml).toContain(`<Y1>${(W - 38).toFixed(2)}</Y1>`);
    expect(xml).toContain(`<Y1>${(W - 35).toFixed(2)}</Y1>`);
    expect(xml).toContain("<Depth>30.00</Depth>");
    expect(xml).toContain("<Depth>13.00</Depth>");
    expect(xml).toContain(`<BeginY>${(W - 13).toFixed(2)}</BeginY>`);
    expect(xml).toContain(`<BeginY>${(W - 23).toFixed(2)}</BeginY>`);
    expect((xml.match(/<CAD>/g) ?? []).length).toBe(6);
  });

  it("LAT_ESQ — espelho (face X=T/2, aresta X=L)", () => {
    const holes = computeDrawerLateralStructuralHoles({
      largura: L,
      altura: W,
      espessura: T,
      side: "esq",
    });
    expect(holes.filter((h) => h.topDrillable).map((h) => h.x)).toEqual([T / 2, T / 2]);
    expect(holes.filter((h) => h.tipo === "cavilha" && !h.topDrillable).map((h) => h.x)).toEqual([
      L,
      L,
    ]);
    const xml = xmlFor("gaveta_lat_esq", { largura: L, altura: W, espessura: T });
    expect(xml).toContain("<X1>8.00</X1>");
    expect(xml).toContain("<X1>540.00</X1>");
    expect(xml).toContain("<Quadrant>1</Quadrant>");
  });
});

describe("golden XML_COMPLITO — costa", () => {
  it("altura = lateral × percentualCosta; Y=15/W-15; Depth 30; topo X=8", () => {
    const sideH = 195.5;
    const costaH = sideH * settingsDefaults.gavetas.gavetaPercentualReducaoCosta;
    expect(costaH).toBeCloseTo(166.175, 3);
    const holes = computeDrawerCostaStructuralHoles({
      largura: 716,
      altura: costaH,
      espessura: 16,
    });
    expect(holes.filter((h) => h.tipo === "cavilha").map((h) => h.y)).toEqual([
      15, 15, costaH - 15, costaH - 15,
    ]);
    expect(holes.filter((h) => h.tipo === "cavilha")[0]!.profundidade).toBe(30);
    const tops = holes.filter((h) => h.face === "cima");
    expect(tops.map((h) => [h.x, h.y, h.diametro, h.profundidade])).toEqual([
      [8, costaH, 10, 10],
      [716 - 8, costaH, 10, 10],
    ]);
    expect(tops.every((h) => h.diametro === 10)).toBe(true);
    expect(tops.every((h) => h.diametro !== 5)).toBe(true);

    const xml = xmlFor("gaveta_traseira", {
      largura: 716,
      altura: costaH,
      espessura: 16,
    });
    expect(xml).toContain("<PanelWidth>166.17</PanelWidth>");
    expect(xml).toContain("<Depth>30.00</Depth>");
    expect(xml).toContain("<Y1>15.00</Y1>");
    expect(xml).toContain(`<Y1>${(costaH - 15).toFixed(2)}</Y1>`);
    expect(xml).toContain(`<Y1>${costaH.toFixed(2)}</Y1>`);
    expect(xml).toContain("<X1>8.00</X1>");
    expect(xml).toContain("<X1>708.00</X1>");
    expect(xml).toContain("<Diameter>10.00</Diameter>");
    expect(xml).not.toContain("<Diameter>5.00</Diameter>");
  });
});

describe("golden XML_COMPLITO — frente inferior pairing laterais", () => {
  const L = 798;
  const W = 260.67;
  const T = 19;
  const sideH = 195.5;
  const elev = 18;

  it("legado fixed holes: rasgo W-56.5; cavilhas = elev+15 e elev+(sideH-35); X=33", () => {
    const holes = computeDrawerLowestFrenteExtFixedHoles({
      largura: L,
      altura: W,
      espessura: T,
      bottomThicknessMm: 10,
      sideHeightMm: sideH,
      sideBaseElevationMm: elev,
      bodyWidthMm: L - 50,
      sideThicknessMm: 16,
    });
    const groove = holes.find((h) => h.holeSubtype === "groove")!;
    expect(groove.y).toBeCloseTo(W - 56.5, 5);
    expect(groove.x).toBe(12);
    expect(groove.grooveLength).toBe(L - 24);
    expect(groove.profundidade).toBe(11);

    const cav = holes.filter((h) => h.tipo === "cavilha");
    expect(cav).toHaveLength(4);
    const lowerY = elev + 15;
    const upperY = elev + (sideH - 35);
    expect(cav.filter((h) => Math.abs(h.y - lowerY) < 0.01)).toHaveLength(2);
    expect(cav.filter((h) => Math.abs(h.y - upperY) < 0.01)).toHaveLength(2);
    expect(cav.every((h) => h.x === 33 || h.x === L - 33)).toBe(true);
    expect(cav.every((h) => h.topDrillable === true)).toBe(true);
    expect(Math.abs(upperY - lowerY)).toBeGreaterThan(50);
  });

  it("produção GAV_FRENTE_EXT_01 (lowest): cavilha inferior desce a elev+0; rasgo fixo 53mm", () => {
    // Inferior: cavilha desce de elev+15 para elev+0 (liberta espaço ao rasgo fixo).
    const lowerY = elev;
    const upperY = elev + (sideH - 35);
    const grooveY = 53; // DRAWER_LOWEST_FRONT_BOTTOM_GROOVE_FROM_BASE_MM — fixo, não elev+sideH−13

    const xml = xmlFor(
      "gaveta_frente_ext",
      { largura: L, altura: W, espessura: T },
      {
        drawerStackRole: "lowest",
        drawerSideHeightMm: sideH,
        drawerSideBaseElevationMm: elev,
        drawerBottomThicknessMm: 10,
        drawerBodyWidthMm: L - 50,
        drawerSideThicknessMm: 16,
        isLowestDrawer: true,
      }
    );
    expect(xml).toContain("<TypeNo>1</TypeNo>");
    expect(xml).toContain("<X1>33.00</X1>");
    expect(xml).toContain(`<Y1>${lowerY.toFixed(2)}</Y1>`);
    expect(xml).toContain(`<Y1>${upperY.toFixed(2)}</Y1>`);
    // Rasgo alinhado ao gav_fundo (bottomWidth = bodyWidth − 2×(16−10)), não ao bodyWidth.
    const bodyWidthMm = L - 50;
    const bottomWidthMm = bodyWidthMm - 2 * (16 - 10);
    const grooveOverhang = (L - bottomWidthMm) / 2;
    expect(xml).toContain(`<BeginX>${grooveOverhang.toFixed(2)}</BeginX>`);
    expect(xml).toContain(`<EndX>${(grooveOverhang + bottomWidthMm).toFixed(2)}</EndX>`);
    expect(xml).toContain(`<BeginY>${grooveY.toFixed(2)}</BeginY>`);
    expect(xml).toContain("<Width>11.00</Width>");
    expect(xml).toContain("<Depth>11.00</Depth>");
    expect(xml).not.toMatch(/<TypeNo>3<\/TypeNo>[\s\S]*?<Depth>13\.00<\/Depth>/);
    expect(xml).not.toContain(`<BeginY>${(W - 56.5).toFixed(2)}</BeginY>`);
    expect(xml).not.toContain("<TypeNo>2</TypeNo>");
  });
});
