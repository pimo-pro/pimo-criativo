/**
 * Golden reference ù GAVETA 1/XML_COMPLITO (apenas DRILL).
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
import { DRAWER_COSTA_HEIGHT_BELOW_LATERAL_MM } from "../drawers/drawerGeometryConstants";

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

describe("golden SSOT cx gav lat ù laterais transversais", () => {
  // cutlist: largura=profundidade, altura=altura
  const depth = 540;
  const height = 195.5;
  const T = 16;

  it("LAT_DIR ù 4 cavilhas TypeNo2 Y=60 + grelha ù5; sem rasgos", () => {
    const holes = computeDrawerLateralStructuralHoles({
      largura: depth,
      altura: height,
      espessura: T,
      side: "dir",
    });
    const cavilhas = holes.filter((h) => h.tipo === "cavilha");
    expect(cavilhas.map((h) => [h.x, h.y, h.profundidade]).sort()).toEqual(
      [
        [0, 60, 30],
        [0, depth - 60, 30],
        [height, 60, 30],
        [height, depth - 60, 30],
      ].sort()
    );
    expect(holes.filter((h) => h.tipo === "corredica")).toHaveLength(15);
    expect(holes.filter((h) => h.holeSubtype === "groove")).toHaveLength(0);

    const xml = xmlFor("gaveta_lat_dir", { largura: depth, altura: height, espessura: T });
    expect(xml).toContain("<PanelLength>195.50</PanelLength>");
    expect(xml).toContain("<PanelWidth>540.00</PanelWidth>");
    expect(xml).toContain("<Y1>60.00</Y1>");
    expect(xml).toContain("<Depth>30.00</Depth>");
    expect(xml).toContain("<Diameter>5.00</Diameter>");
    expect(xml).not.toContain("<TypeNo>3</TypeNo>");
    expect((xml.match(/<CAD>/g) ?? []).length).toBe(19);
  });

  it("LAT_ESQ ù cavilhas iguais; grelha X espelhada", () => {
    const holes = computeDrawerLateralStructuralHoles({
      largura: depth,
      altura: height,
      espessura: T,
      side: "esq",
    });
    const cavilhas = holes.filter((h) => h.tipo === "cavilha");
    expect(cavilhas).toHaveLength(4);
    expect([...new Set(cavilhas.map((h) => h.x))].sort((a, b) => a - b)).toEqual([0, height]);
    const guideXs = [
      ...new Set(holes.filter((h) => h.tipo === "corredica").map((h) => h.x)),
    ].sort((a, b) => a - b);
    const L = height;
    const raw = [
      41,
      Number(((L * 323.33) / 862).toFixed(2)),
      Number(((L * 624.67) / 862).toFixed(2)),
    ].filter((x) => x > 0 && x < L);
    expect(guideXs).toEqual(raw.map((x) => Number((L - x).toFixed(2))).sort((a, b) => a - b));

    const xml = xmlFor("gaveta_lat_esq", { largura: depth, altura: height, espessura: T });
    expect(xml).toContain("<PanelLength>195.50</PanelLength>");
    expect(xml).toContain("<X1>0.00</X1>");
    expect(xml).toContain("<X1>195.50</X1>");
  });
});

describe("golden XML_COMPLITO ù costa", () => {
  it("altura = lateral ? 23; Y=15/W-15; Depth 30; topo X=8", () => {
    const sideH = 195.5;
    const costaH = sideH - DRAWER_COSTA_HEIGHT_BELOW_LATERAL_MM;
    expect(costaH).toBe(172.5);
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
    expect(tops.map((h) => [h.x, h.y, h.profundidade])).toEqual([
      [8, costaH, 10],
      [716 - 8, costaH, 10],
    ]);

    const xml = xmlFor("gaveta_traseira", {
      largura: 716,
      altura: costaH,
      espessura: 16,
    });
    expect(xml).toContain("<PanelWidth>172.50</PanelWidth>");
    expect(xml).toContain("<Depth>30.00</Depth>");
    expect(xml).toContain("<Y1>15.00</Y1>");
    expect(xml).toContain(`<Y1>${(costaH - 15).toFixed(2)}</Y1>`);
  });
});

describe("golden XML_COMPLITO ù frente inferior pairing laterais", () => {
  const L = 798;
  const W = 260.67;
  const T = 19;
  const sideH = 195.5;
  const elev = 18.5;

  it("rasgo W-56.5; cavilhas = elev+15 e elev+(sideH-35); X=33", () => {
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
    expect(xml).toContain("<BeginX>12.00</BeginX>");
    expect(xml).toContain(`<EndX>${(L - 12).toFixed(2)}</EndX>`);
    expect(xml).toContain(`<BeginY>${(W - 56.5).toFixed(2)}</BeginY>`);
    expect(xml).not.toContain("<TypeNo>2</TypeNo>");
  });
});
