import { describe, expect, it } from "vitest";
import { buildDrillFilesForProject } from "./drillExport";
import { buildPanelDrillingResult } from "../../modules/drilling/drillingAdapter";
import { defaultRulesConfig } from "../rules/rulesConfig";
import type { CutListItemComPreco } from "../types";

/** Dimensões do XML industrial FRENTE_INT.xml (L=500, W=200, T=16). */
const FRENTE_INT_DIMS = { largura: 500, altura: 200, espessura: 16 } as const;

function buildFrenteIntXml(): string {
  const drilling = buildPanelDrillingResult(
    {
      tipo: "gaveta_frente_int",
      larguraMm: FRENTE_INT_DIMS.largura,
      alturaMm: FRENTE_INT_DIMS.altura,
      espessuraMm: FRENTE_INT_DIMS.espessura,
    },
    defaultRulesConfig
  );
  expect(drilling.success).toBe(true);

  const item: CutListItemComPreco = {
    id: "frente-int-test",
    nome: "FRENTE_INT",
    tipo: "gaveta_frente_int",
    quantidade: 1,
    dimensoes: {
      largura: FRENTE_INT_DIMS.largura,
      altura: FRENTE_INT_DIMS.altura,
      profundidade: FRENTE_INT_DIMS.espessura,
    },
    espessura: FRENTE_INT_DIMS.espessura,
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
}

describe("drillExport — FRENTE_INT alinhado com XML industrial", () => {
  it("painel KDT: PanelLength=L, PanelWidth=W", () => {
    const xml = buildFrenteIntXml();
    expect(xml).toContain("<PanelLength>500.00</PanelLength>");
    expect(xml).toContain("<PanelWidth>200.00</PanelWidth>");
    expect(xml).toContain("<PanelThickness>16.00</PanelThickness>");
  });

  it("4 cavilhas laterais padrão costa (DRILL; sem rasgo / face / Ø5)", () => {
    const xml = buildFrenteIntXml();
    expect((xml.match(/<CAD>/g) ?? []).length).toBe(4);
    expect(xml).not.toContain("<TypeNo>3</TypeNo>");
    expect(xml).not.toContain("<Diameter>5.00</Diameter>");
    expect((xml.match(/<Diameter>10.00<\/Diameter>/g) ?? []).length).toBe(4);
    expect(xml).toContain("<Depth>30.00</Depth>");
    expect(xml).not.toContain("<Depth>13.00</Depth>");
  });

  it("furos laterais X=0 e X=L com Y=15 e H−15; Depth aresta=30 (padrão costa)", () => {
    const xml = buildFrenteIntXml();
    expect(xml).toContain("<X1>0.00</X1>");
    expect(xml).toContain("<X1>500.00</X1>");
    expect(xml).toContain("<Y1>15.00</Y1>");
    expect(xml).toContain("<Y1>185.00</Y1>"); // 200 − 15
    expect(xml).toContain("<Z1>8.00</Z1>");
    expect(xml).toContain("<Depth>30.00</Depth>");
    expect(xml).toContain("<Diameter>10.00</Diameter>");
  });

  it("Quadrant 2 em X=0 e Quadrant 1 em X=L", () => {
    const xml = buildFrenteIntXml();
    const blocks = xml.split("<CAD>").slice(1);
    const q2 = blocks.filter((b) => b.includes("<X1>0.00</X1>") && b.includes("<Quadrant>2</Quadrant>"));
    const q1 = blocks.filter((b) => b.includes("<X1>500.00</X1>") && b.includes("<Quadrant>1</Quadrant>"));
    expect(q2).toHaveLength(2);
    expect(q1).toHaveLength(2);
  });
});
