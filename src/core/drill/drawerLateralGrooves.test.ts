/**
 * Rasgos inferiores laterais — helper legado mantido;
 * SSOT cx gav lat: laterais estruturais NÃO injectam rasgos.
 */
import { describe, expect, it } from "vitest";
import {
  buildDrawerLateralBottomGrooves,
  computeDrawerLateralStructuralHoles,
} from "../drawers/drilling/DrawerDrillingRules";
import {
  DRAWER_LAT_GROOVE_BOTTOM_DEPTH_MM,
  DRAWER_LAT_GROOVE_BOTTOM_FROM_TOP_MM,
  DRAWER_LAT_GROOVE_BOTTOM_WIDTH_MM,
  DRAWER_LAT_GROOVE_CORRECTION,
  DRAWER_LAT_GROOVE_OVERCUT_MM,
  DRAWER_LAT_GROOVE_TOOL_NAME,
  DRAWER_LAT_GROOVE_TOP_DEPTH_MM,
  DRAWER_LAT_GROOVE_TOP_FROM_TOP_MM,
  DRAWER_LAT_GROOVE_TOP_WIDTH_MM,
} from "../drawers/drawerGeometryConstants";
import { buildDrillStationXmlFilesForProject } from "./drillExport";
import { buildPanelDrillingResult } from "../../modules/drilling/drillingAdapter";
import { defaultRulesConfig } from "../rules/rulesConfig";
import type { CutListItemComPreco } from "../types";
import { withIndustrialOutputAuthorization } from "../industrial/industrialOutputGuard";

function xmlFor(
  tipo: "gaveta_lat_esq" | "gaveta_lat_dir",
  L: number,
  W: number,
  T = 16
): string {
  return withIndustrialOutputAuthorization("all", () => {
    const drilling = buildPanelDrillingResult(
      { tipo, larguraMm: L, alturaMm: W, espessuraMm: T },
      defaultRulesConfig
    );
    expect(drilling.success).toBe(true);
    const item: CutListItemComPreco = {
      id: `${tipo}-${L}`,
      nome: tipo,
      tipo,
      quantidade: 1,
      dimensoes: { largura: L, altura: W, profundidade: T },
      espessura: T,
      material: "mdf",
      drillHoles: drilling.data!.drillHoles,
      precoUnitario: 0,
      precoTotal: 0,
    };
    return (
      buildDrillStationXmlFilesForProject([item], {
        projectName: "LAT_GROOVE",
        boxes: [],
        rules: defaultRulesConfig,
      })[0]?.xml ?? ""
    );
  });
}

describe("rasgos laterais gaveta — SSOT sem injectar nas laterais", () => {
  it("constantes industriais do helper legado", () => {
    expect(DRAWER_LAT_GROOVE_TOP_FROM_TOP_MM).toBe(13);
    expect(DRAWER_LAT_GROOVE_TOP_WIDTH_MM).toBe(13);
    expect(DRAWER_LAT_GROOVE_TOP_DEPTH_MM).toBe(3);
    expect(DRAWER_LAT_GROOVE_BOTTOM_FROM_TOP_MM).toBe(23);
    expect(DRAWER_LAT_GROOVE_BOTTOM_WIDTH_MM).toBe(11);
    expect(DRAWER_LAT_GROOVE_BOTTOM_DEPTH_MM).toBe(10);
    expect(DRAWER_LAT_GROOVE_OVERCUT_MM).toBe(10);
    expect(DRAWER_LAT_GROOVE_CORRECTION).toBe(2);
    expect(DRAWER_LAT_GROOVE_TOOL_NAME).toBe("FRESA_DESBASTE_10MM");
  });

  it("helper buildDrawerLateralBottomGrooves ainda disponível", () => {
    for (const L of [400, 540, 700]) {
      const grooves = buildDrawerLateralBottomGrooves(L, 195.5);
      expect(grooves).toHaveLength(2);
      expect(grooves.map((g) => [g.y, g.grooveWidth, g.profundidade])).toEqual([
        [195.5 - 13, 13, 3],
        [195.5 - 23, 11, 10],
      ]);
    }
  });

  it.each(["gaveta_lat_esq", "gaveta_lat_dir"] as const)(
    "%s XML: zero TypeNo3 (SSOT cx gav lat)",
    (tipo) => {
      const xml = xmlFor(tipo, 540, 195.5);
      expect(xml).not.toContain("<TypeNo>3</TypeNo>");
      expect(xml).not.toContain("FRESA_DESBASTE_10MM");
    }
  );

  it("estrutural: esq e dir sem rasgos", () => {
    const esq = computeDrawerLateralStructuralHoles({
      largura: 500,
      altura: 180,
      espessura: 16,
      side: "esq",
    }).filter((h) => h.holeSubtype === "groove");
    const dir = computeDrawerLateralStructuralHoles({
      largura: 500,
      altura: 180,
      espessura: 16,
      side: "dir",
    }).filter((h) => h.holeSubtype === "groove");
    expect(esq).toHaveLength(0);
    expect(dir).toHaveLength(0);
  });
});
