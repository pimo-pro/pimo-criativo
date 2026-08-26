import { describe, expect, it } from "vitest";
import type { CutListItemComPreco } from "../types";
import { computeChapasReal } from "./computeChapasReal";
import {
  clearChapasOficiaisPro,
  publishChapasOficiaisPro,
} from "./chapasOficiaisProStore";
import { buildChapasOficiaisFingerprint } from "./cutlistFingerprint";
import { buildChapasSummaryFromProBundles } from "./chapasSummaryFromProBundles";
import {
  groupCutlistItemsByMaterialAndThickness,
  resolveMaterialLabelForCutlistItem,
} from "../cnc/industrialThicknessGroups";
import { cutlistToPieces, runCutLayout, type CutlistItemForPieces } from "../cutlayout/cutLayoutEngine";
import {
  getFastCncLayoutOptions,
  getSheetDefinitionFromSettings,
} from "../cnc/cncPipeline";
import { enrichPiecesWithMaterialSheetDimensions } from "../cnc/preparePiecesForNesting";

function makeItem(
  overrides: Partial<CutListItemComPreco> & {
    nome: string;
    material: string;
    materialId: string;
    espessura: number;
    largura: number;
    altura: number;
    quantidade?: number;
  }
): CutListItemComPreco {
  const esp = overrides.espessura;
  return {
    id: overrides.id ?? overrides.nome,
    nome: overrides.nome,
    quantidade: overrides.quantidade ?? 1,
    dimensoes: {
      largura: overrides.largura,
      altura: overrides.altura,
      profundidade: esp,
    },
    espessura: esp,
    material: overrides.material,
    materialId: overrides.materialId,
    tipo: overrides.tipo ?? "lateral",
    boxId: overrides.boxId ?? "box-1",
    precoUnitario: 0,
    precoTotal: 0,
  };
}

describe("computeChapasReal - parity with TCN grouping", () => {
  it("does not merge same-thickness materials (HDF not absorbed by MDF)", () => {
    const items: CutListItemComPreco[] = [
      makeItem({
        nome: "Lat_MDF_A",
        material: "MDF Branco 19",
        materialId: "mdf_branco-19",
        espessura: 19,
        largura: 2000,
        altura: 1800,
      }),
      makeItem({
        nome: "Lat_MDF_B",
        material: "MDF Branco 19",
        materialId: "mdf_branco-19",
        espessura: 19,
        largura: 2000,
        altura: 1800,
      }),
      makeItem({
        nome: "Costa_HDF",
        material: "HDF CRU 19mm",
        materialId: "hdf_cru-19",
        espessura: 19,
        largura: 1500,
        altura: 1000,
        tipo: "prateleira",
      }),
      makeItem({
        nome: "Porta_Carvalho",
        material: "Carvalho 20",
        materialId: "carvalho-20",
        espessura: 20,
        largura: 600,
        altura: 2000,
        tipo: "porta",
      }),
    ];

    const result = computeChapasReal(items, "TesteParity", [{ id: "box-1", nome: "Caixa 1" }]);
    expect(result.sheets.length).toBeGreaterThan(0);

    const byMaterial = new Map<string, number>();
    for (const s of result.sheets) {
      byMaterial.set(s.material, (byMaterial.get(s.material) ?? 0) + 1);
    }

    const materialsPresent = [...byMaterial.keys()].join(" | ").toLowerCase();
    // Root cause (Antunes): HDF 19 and MDF 19 must stay distinct sheet labels.
    expect(materialsPresent).toMatch(/mdf/);
    expect(materialsPresent).toMatch(/hdf/);
    expect(materialsPresent).toMatch(/carvalho/);
    expect(byMaterial.size).toBeGreaterThanOrEqual(3);

    const mdfSheets = [...byMaterial.entries()]
      .filter(([k]) => /mdf/i.test(k))
      .reduce((s, [, q]) => s + q, 0);
    const hdfSheets = [...byMaterial.entries()]
      .filter(([k]) => /hdf/i.test(k))
      .reduce((s, [, q]) => s + q, 0);
    expect(mdfSheets).toBeGreaterThanOrEqual(1);
    expect(hdfSheets).toBeGreaterThanOrEqual(1);
  });

  it("sheet counts per material+thickness match TCN-style per-group nesting", () => {
    const items: CutListItemComPreco[] = [
      makeItem({
        nome: "A1",
        material: "MDF Branco 19",
        materialId: "mdf_branco-19",
        espessura: 19,
        largura: 1200,
        altura: 800,
        quantidade: 3,
      }),
      makeItem({
        nome: "H1",
        material: "HDF CRU 19mm",
        materialId: "hdf_cru-19",
        espessura: 19,
        largura: 900,
        altura: 700,
        quantidade: 2,
      }),
      makeItem({
        nome: "C1",
        material: "Carvalho 20",
        materialId: "carvalho-20",
        espessura: 20,
        largura: 700,
        altura: 1800,
        quantidade: 2,
      }),
    ];

    const projectName = "ParityCount";
    const boxes = [{ id: "box-1", nome: "Caixa 1" }];
    const summary = computeChapasReal(items, projectName, boxes);

    const groups = groupCutlistItemsByMaterialAndThickness(items as CutlistItemForPieces[]);
    const sheetDef = getSheetDefinitionFromSettings();
    const opts = getFastCncLayoutOptions(sheetDef);

    const expectedByLabel = new Map<string, number>();
    for (const groupItems of groups.values()) {
      const label = resolveMaterialLabelForCutlistItem(groupItems[0]!);
      const pieces = enrichPiecesWithMaterialSheetDimensions(
        cutlistToPieces(groupItems, { projectName, boxes })
      );
      if (pieces.length === 0) continue;
      const layout = runCutLayout(pieces, sheetDef, opts);
      expectedByLabel.set(label, (expectedByLabel.get(label) ?? 0) + layout.sheets.length);
    }

    const actualByLabel = new Map<string, number>();
    for (const s of summary.sheets) {
      actualByLabel.set(s.material, (actualByLabel.get(s.material) ?? 0) + 1);
    }

    expect(actualByLabel.size).toBe(expectedByLabel.size);
    for (const [label, qty] of expectedByLabel) {
      expect(actualByLabel.get(label)).toBe(qty);
    }
  });

  it("cutlist vazio → mode vazio + diagnostics", () => {
    const result = computeChapasReal([], "Vazio", []);
    expect(result.mode).toBe("vazio");
    expect(result.sheets).toEqual([]);
    expect(result.totalSheets).toBe(0);
    expect(result.diagnostics.some((d) => d.includes("vazio"))).toBe(true);
  });

  it("fast com sheets → mode=estimado (A1, não oficial)", () => {
    const items: CutListItemComPreco[] = [
      makeItem({
        nome: "Lat_A",
        material: "MDF Branco 19",
        materialId: "mdf_branco-19",
        espessura: 19,
        largura: 600,
        altura: 400,
      }),
    ];
    const result = computeChapasReal(items, "TesteMode", [{ id: "box-1", nome: "Caixa 1" }]);
    if (result.sheets.length > 0) {
      expect(result.mode).toBe("estimado");
      expect(result.diagnostics.some((d) => d.includes("nesting_fast_a1"))).toBe(true);
    } else {
      expect(result.mode).toBe("estimado");
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0]).toMatch(/fallback estimado|chapasReais€=0/);
    }
  });

  it("snapshot PRO válido → mode=oficial_pro", () => {
    clearChapasOficiaisPro();
    const items: CutListItemComPreco[] = [
      makeItem({
        nome: "Lat_Pro",
        material: "MDF Branco 19",
        materialId: "mdf_branco-19",
        espessura: 19,
        largura: 600,
        altura: 400,
      }),
    ];
    const projectName = "Projeto Oficial Chapas";
    const fingerprint = buildChapasOficiaisFingerprint(items as CutlistItemForPieces[]);
    const summary = buildChapasSummaryFromProBundles({
      bundles: [
        {
          thicknessMm: 19,
          materialLabel: "MDF Branco",
          items: items as CutlistItemForPieces[],
          layoutResult: {
            sheets: [
              {
                sheet: { largura_mm: 2800, altura_mm: 2070, espessura_mm: 19 },
                placements: [
                  {
                    x_mm: 0,
                    y_mm: 0,
                    largura_mm: 600,
                    altura_mm: 400,
                    rotacao: 0,
                    sheetIndex: 0,
                    boxId: "box-1",
                    partName: "lateral",
                  },
                ],
              },
            ],
          },
        },
      ],
      projectName,
      boxes: [{ id: "box-1", nome: "C1" }],
    });
    expect(
      publishChapasOficiaisPro({
        projectId: projectName,
        fingerprint,
        summary,
        isProMode: true,
      })
    ).toBe(true);

    const result = computeChapasReal(items, projectName, [{ id: "box-1" }], {
      projectId: projectName,
    });
    expect(result.mode).toBe("oficial_pro");
    expect(result.totalSheets).toBe(1);
    clearChapasOficiaisPro();
  });

  it("fingerprint stale (cutlist mudou após publish) → estimado", () => {
    clearChapasOficiaisPro();
    const itemsA: CutListItemComPreco[] = [
      makeItem({
        nome: "Lat_A",
        material: "MDF Branco 19",
        materialId: "mdf_branco-19",
        espessura: 19,
        largura: 600,
        altura: 400,
      }),
    ];
    const itemsB: CutListItemComPreco[] = [
      makeItem({
        nome: "Lat_A",
        material: "MDF Branco 19",
        materialId: "mdf_branco-19",
        espessura: 19,
        largura: 700,
        altura: 400,
      }),
    ];
    const projectName = "Projeto Stale Fingerprint";
    const fingerprintA = buildChapasOficiaisFingerprint(itemsA as CutlistItemForPieces[]);
    const summary = buildChapasSummaryFromProBundles({
      bundles: [
        {
          thicknessMm: 19,
          materialLabel: "MDF Branco",
          items: itemsA as CutlistItemForPieces[],
          layoutResult: {
            sheets: [
              {
                sheet: { largura_mm: 2800, altura_mm: 2070, espessura_mm: 19 },
                placements: [
                  {
                    x_mm: 0,
                    y_mm: 0,
                    largura_mm: 600,
                    altura_mm: 400,
                    rotacao: 0,
                    sheetIndex: 0,
                    boxId: "box-1",
                    partName: "lateral",
                  },
                ],
              },
            ],
          },
        },
      ],
      projectName,
      boxes: [{ id: "box-1" }],
    });
    publishChapasOficiaisPro({
      projectId: projectName,
      fingerprint: fingerprintA,
      summary,
      isProMode: true,
    });

    const result = computeChapasReal(itemsB, projectName, [{ id: "box-1" }], {
      projectId: projectName,
    });
    expect(result.mode).toBe("estimado");
    expect(result.mode).not.toBe("oficial_pro");
    clearChapasOficiaisPro();
  });

  it("peças nas chapas trazem nome completo + N QR (= buildIndustrialId)", () => {
    const items: CutListItemComPreco[] = [
      makeItem({
        nome: "Lateral esquerda",
        tipo: "lateral_esquerda",
        material: "MDF Branco 19",
        materialId: "mdf_branco-19",
        espessura: 19,
        largura: 500,
        altura: 700,
      }),
    ];
    const result = computeChapasReal(items, "Khaled Cozinha Nova", [
      { id: "box-1", nome: "C 1" },
    ]);
    if (result.sheets.length === 0) return;
    const piece = result.sheets[0]!.pieces[0];
    expect(piece).toBeTruthy();
    expect(piece!.nome).toBe("khaled_cozinha_nova_c_1_lat_esq");
    expect(piece!.nQr).toBe("kcnc1le");
    expect(piece!.nQr).not.toMatch(/-/);
  });
});
