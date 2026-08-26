import { describe, expect, it } from "vitest";
import {
  buildChapasSummaryFromProBundles,
  countSheetsFromProBundles,
  type ProLayoutBundleForChapas,
} from "./chapasSummaryFromProBundles";

function fakeBundle(
  overrides: Partial<ProLayoutBundleForChapas> & {
    sheetCount?: number;
    thicknessMm?: number;
    materialLabel?: string;
  } = {}
): ProLayoutBundleForChapas {
  const sheetCount = overrides.sheetCount ?? 2;
  const thicknessMm = overrides.thicknessMm ?? 19;
  const materialLabel = overrides.materialLabel ?? "MDF Branco";
  const sheets = Array.from({ length: sheetCount }, (_, i) => ({
    sheet: {
      largura_mm: 2800,
      altura_mm: 2070,
      espessura_mm: thicknessMm,
      materialName: materialLabel,
    },
    placements: [
      {
        x_mm: 0,
        y_mm: 0,
        largura_mm: 600,
        altura_mm: 400,
        rotacao: 0,
        sheetIndex: i,
        boxId: "box-1",
        partName: "lateral_esquerda",
      },
    ],
  }));

  return {
    thicknessMm,
    materialLabel,
    items: [
      {
        id: "p1",
        nome: "Lateral esquerda",
        tipo: "lateral_esquerda",
        quantidade: 1,
        dimensoes: { largura: 600, altura: 400, profundidade: thicknessMm },
        material: materialLabel,
        materialId: "mdf_branco-19",
        boxId: "box-1",
      } as ProLayoutBundleForChapas["items"][number],
    ],
    layoutResult: { sheets },
    ...overrides,
  };
}

describe("buildChapasSummaryFromProBundles", () => {
  it("agrega sheets de vários grupos (= nº TCN)", () => {
    const bundles = [
      fakeBundle({ sheetCount: 2, materialLabel: "MDF Branco", thicknessMm: 19 }),
      fakeBundle({ sheetCount: 1, materialLabel: "HDF CRU", thicknessMm: 3 }),
    ];
    expect(countSheetsFromProBundles(bundles)).toBe(3);

    const summary = buildChapasSummaryFromProBundles({
      bundles,
      projectName: "Teste",
      boxes: [{ id: "box-1", nome: "C1" }],
    });

    expect(summary.mode).toBe("oficial_pro");
    expect(summary.totalSheets).toBe(3);
    expect(summary.sheets).toHaveLength(3);
    expect(summary.diagnostics).toContain("origem=oficial_pro");
    expect(summary.sheets.map((s) => s.material)).toEqual([
      "MDF Branco",
      "MDF Branco",
      "HDF CRU",
    ]);
    expect(summary.sheets[0]!.sheetIndex).toBe(1);
    expect(summary.sheets[2]!.sheetIndex).toBe(3);
  });

  it("bundles vazios → mode vazio (não publicável)", () => {
    const summary = buildChapasSummaryFromProBundles({
      bundles: [fakeBundle({ sheetCount: 0 })],
      projectName: "Vazio",
      boxes: [],
    });
    expect(summary.mode).toBe("vazio");
    expect(summary.totalSheets).toBe(0);
    expect(summary.sheets).toHaveLength(0);
  });
});
