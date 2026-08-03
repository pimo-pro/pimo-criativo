import { describe, expect, it } from "vitest";
import { buildDrillFilesForProject } from "./drillExport";
import { buildPanelDrillingResult } from "../../modules/drilling/drillingAdapter";
import { defaultRulesConfig } from "../rules/rulesConfig";
import type { CutListItemComPreco } from "../types";
import { withIndustrialOutputAuthorization } from "../industrial/industrialOutputGuard";

/**
 * Cutlist: largura=profundidade, altura=altura_gaveta.
 * XML transversal SSOT: L=altura, W=largura (modelo cx gav lat).
 */
const LAT_DIR_DIMS = { largura: 540, altura: 195.5, espessura: 16 } as const;

function buildLatDirXml(): string {
  return withIndustrialOutputAuthorization("all", () => {
    const drilling = buildPanelDrillingResult(
      {
        tipo: "gaveta_lat_dir",
        larguraMm: LAT_DIR_DIMS.largura,
        alturaMm: LAT_DIR_DIMS.altura,
        espessuraMm: LAT_DIR_DIMS.espessura,
      },
      defaultRulesConfig
    );
    expect(drilling.success).toBe(true);

    const item: CutListItemComPreco = {
      id: "lat-dir-test",
      nome: "LAT_DIR",
      tipo: "gaveta_lat_dir",
      quantidade: 1,
      dimensoes: {
        largura: LAT_DIR_DIMS.largura,
        altura: LAT_DIR_DIMS.altura,
        profundidade: LAT_DIR_DIMS.espessura,
      },
      espessura: LAT_DIR_DIMS.espessura,
      material: "mdf_branco",
      drillHoles: drilling.data!.drillHoles,
      precoUnitario: 0,
      precoTotal: 0,
    };

    const files = buildDrillFilesForProject([item], {
      projectName: "Teste",
      boxes: [],
      rules: defaultRulesConfig,
    });
    expect(files.length).toBeGreaterThanOrEqual(1);
    const drill = files.find((f) => f.machineTarget === "drill") ?? files[0]!;
    return drill.xml;
  });
}

describe("drillExport — LAT_DIR SSOT transversal cx gav lat", () => {
  it("painel KDT transversal: L=altura W=profundidade", () => {
    const xml = buildLatDirXml();
    expect(xml).toContain("<PanelLength>195.50</PanelLength>");
    expect(xml).toContain("<PanelWidth>540.00</PanelWidth>");
    expect(xml).toContain("<PanelThickness>16.00</PanelThickness>");
  });

  it("19 CAD: 4 cavilhas TypeNo2 + 15 guias Ø5; sem rasgos", () => {
    const xml = buildLatDirXml();
    expect((xml.match(/<CAD>/g) ?? []).length).toBe(19);
    expect(xml).toContain("<Diameter>5.00</Diameter>");
    expect(xml).toContain("<Diameter>10.00</Diameter>");
    expect(xml).toContain("<Depth>30.00</Depth>");
    expect(xml).toContain("<Depth>1.00</Depth>");
    expect(xml).not.toContain("<TypeNo>3</TypeNo>");
    expect(xml).not.toContain("<Depth>13.00</Depth>");
  });

  it("cavilhas TypeNo2 em X=0/L Y=60/W-60", () => {
    const xml = buildLatDirXml();
    expect(xml).toContain("<TypeNo>2</TypeNo>");
    expect(xml).toContain("<X1>0.00</X1>");
    expect(xml).toContain("<X1>195.50</X1>");
    expect(xml).toContain("<Y1>60.00</Y1>");
    expect(xml).toContain("<Y1>480.00</Y1>");
    expect(xml).toContain("<Depth>30.00</Depth>");
  });
});
