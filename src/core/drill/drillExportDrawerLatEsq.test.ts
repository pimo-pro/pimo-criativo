import { describe, expect, it } from "vitest";
import { buildDrillFilesForProject } from "./drillExport";
import { buildPanelDrillingResult } from "../../modules/drilling/drillingAdapter";
import { defaultRulesConfig } from "../rules/rulesConfig";
import type { CutListItemComPreco } from "../types";
import { withIndustrialOutputAuthorization } from "../industrial/industrialOutputGuard";

const LAT_ESQ_DIMS = { largura: 540, altura: 195.5, espessura: 16 } as const;

function buildLatEsqXml(): string {
  return withIndustrialOutputAuthorization("all", () => {
    const drilling = buildPanelDrillingResult(
      {
        tipo: "gaveta_lat_esq",
        larguraMm: LAT_ESQ_DIMS.largura,
        alturaMm: LAT_ESQ_DIMS.altura,
        espessuraMm: LAT_ESQ_DIMS.espessura,
      },
      defaultRulesConfig
    );
    expect(drilling.success).toBe(true);
    expect(drilling.data?.drillHoles.some((h) => h.holeType === "corredica")).toBe(true);
    expect(drilling.data?.drillHoles.some((h) => h.diameter === 5)).toBe(true);

    const item: CutListItemComPreco = {
      id: "lat-esq-test",
      nome: "LAT_ESQ",
      tipo: "gaveta_lat_esq",
      quantidade: 1,
      dimensoes: {
        largura: LAT_ESQ_DIMS.largura,
        altura: LAT_ESQ_DIMS.altura,
        profundidade: LAT_ESQ_DIMS.espessura,
      },
      espessura: LAT_ESQ_DIMS.espessura,
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

describe("drillExport — LAT_ESQ SSOT transversal cx gav lat", () => {
  it("painel KDT transversal", () => {
    const xml = buildLatEsqXml();
    expect(xml).toContain("<PanelLength>195.50</PanelLength>");
    expect(xml).toContain("<PanelWidth>540.00</PanelWidth>");
  });

  it("19 CAD: 4 cavilhas + 15 Ø5; sem rasgos", () => {
    const xml = buildLatEsqXml();
    expect((xml.match(/<CAD>/g) ?? []).length).toBe(19);
    expect(xml).toContain("<Diameter>5.00</Diameter>");
    expect(xml).toContain("<Depth>30.00</Depth>");
    expect(xml).not.toContain("<TypeNo>3</TypeNo>");
  });

  it("cavilhas TypeNo2 em ambos os extremos; grelha espelhada", () => {
    const xml = buildLatEsqXml();
    expect(xml).toContain("<TypeNo>2</TypeNo>");
    expect(xml).toContain("<X1>0.00</X1>");
    expect(xml).toContain("<X1>195.50</X1>");
    expect(xml).toContain("<Y1>60.00</Y1>");
    // L-41 = 154.50 (espelho da coluna frente)
    expect(xml).toContain("<X1>154.50</X1>");
  });
});
