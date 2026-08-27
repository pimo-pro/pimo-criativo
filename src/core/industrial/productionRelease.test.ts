import { describe, expect, it } from "vitest";
import { defaultRulesConfig } from "../rules/rulesConfig";
import { buildProductionRelease, isProductionRelease } from "./productionRelease";
import type { ProLayoutBundleForChapas } from "./chapasSummaryFromProBundles";

function fakeBundle(): ProLayoutBundleForChapas {
  return {
    thicknessMm: 19,
    materialLabel: "MDF Branco",
    items: [],
    layoutResult: {
      sheets: [
        {
          sheet: {
            largura_mm: 2800,
            altura_mm: 2070,
            espessura_mm: 19,
            materialName: "MDF Branco",
          },
          placements: [
            {
              x_mm: 0,
              y_mm: 0,
              largura_mm: 600,
              altura_mm: 400,
              rotacao: 0,
              sheetIndex: 0,
              boxId: "box-1",
              partName: "lateral_esquerda",
            },
          ],
        },
      ],
    },
  };
}

const emptyProject = {
  boxes: [],
  rules: defaultRulesConfig,
  materialId: undefined,
  projectName: "Teste",
  remates: [],
  rodapes: [],
  extractedPartsByBoxId: undefined,
};

describe("buildProductionRelease", () => {
  it("oficial_pro com sheets → release sem layout", () => {
    const release = buildProductionRelease({
      projectId: "proj-1",
      generatedAt: "2026-08-27T10:00:00.000Z",
      bundles: [fakeBundle()],
      project: emptyProject,
    });
    expect(release).not.toBeNull();
    expect(isProductionRelease(release)).toBe(true);
    expect(release!.chapas.mode).toBe("oficial_pro");
    expect(release!.chapas.totalSheets).toBe(1);
    expect("layout" in release!.chapas).toBe(false);
  });

  it("sem sheets PRO → null (não persiste FAST)", () => {
    const release = buildProductionRelease({
      projectId: "proj-1",
      generatedAt: "2026-08-27T10:00:00.000Z",
      bundles: [],
      project: emptyProject,
    });
    expect(release).toBeNull();
  });
});
