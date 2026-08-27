import { afterEach, describe, expect, it } from "vitest";
import { defaultRulesConfig } from "../rules/rulesConfig";
import { FINANCEIRO_CUSTO_KEYS } from "../financeiro/financeiroUnificadoTypes";
import {
  clearChapasOficiaisPro,
  publishChapasOficiaisPro,
} from "./chapasOficiaisProStore";
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
  afterEach(() => {
    clearChapasOficiaisPro();
  });

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

  it("F4: release inclui custos + custosOrigem; isProductionRelease aceita sem custos", () => {
    clearChapasOficiaisPro();
    const release = buildProductionRelease({
      projectId: "proj-1",
      generatedAt: "2026-08-27T10:00:00.000Z",
      bundles: [fakeBundle()],
      project: emptyProject,
    });
    expect(release).not.toBeNull();
    expect(release!.custos).toBeDefined();
    for (const k of FINANCEIRO_CUSTO_KEYS) {
      expect(typeof release!.custos![k]).toBe("number");
    }
    expect(
      release!.custosOrigem === "oficial" || release!.custosOrigem === "estimado_fallback"
    ).toBe(true);
    expect(typeof release!.ivaPct).toBe("number");

    const legacy = { ...release! };
    delete (legacy as { custos?: unknown }).custos;
    delete (legacy as { ivaPct?: unknown }).ivaPct;
    delete (legacy as { custosOrigem?: unknown }).custosOrigem;
    expect(isProductionRelease(legacy)).toBe(true);
  });

  it("F4: cutlist vazio → custosOrigem estimado_fallback (Unificado não chega ao PRO store)", () => {
    clearChapasOficiaisPro();
    const release = buildProductionRelease({
      projectId: "proj-1",
      generatedAt: "2026-08-27T10:00:00.000Z",
      bundles: [fakeBundle()],
      project: emptyProject,
    });
    expect(release!.custosOrigem).toBe("estimado_fallback");
    // Chapas do release continuam PRO (bundles do ZIP), independentemente do freeze Unificado.
    expect(release!.chapas.mode).toBe("oficial_pro");
  });

  it("F4: publish PRO no store não muda gate de chapas do release (bundles)", () => {
    clearChapasOficiaisPro();
    const base = buildProductionRelease({
      projectId: "proj-1",
      generatedAt: "2026-08-27T10:00:00.000Z",
      bundles: [fakeBundle()],
      project: emptyProject,
    });
    expect(base).not.toBeNull();
    publishChapasOficiaisPro({
      projectId: emptyProject.projectName,
      fingerprint: "fp-test",
      summary: base!.chapas,
      isProMode: true,
    });
    const release = buildProductionRelease({
      projectId: "proj-1",
      generatedAt: "2026-08-27T10:00:00.000Z",
      bundles: [fakeBundle()],
      project: emptyProject,
    });
    expect(release!.chapas.mode).toBe("oficial_pro");
    expect(release!.custos).toBeDefined();
  });
});
