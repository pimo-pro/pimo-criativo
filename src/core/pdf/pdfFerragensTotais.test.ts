import { describe, it, expect, vi } from "vitest";
import {
  buildFerragensTotaisPdf,
  chapasRowsForFerragensTotaisPdf,
  ferragensRowsForFerragensTotaisPdf,
  ferragensTotaisPdfFileName,
} from "./pdfFerragensTotais";
import { normalizeFerragensTotaisForPdf } from "./pdfFerragensTotaisNormalize";
import type { ComponentType } from "../components/componentTypes";
import type { Ferragem } from "../ferragens/ferragens";
import type { MaterialIndustrial } from "../manufacturing/materials";
import {
  assertFerragensTotaisInExport,
  exportProjectPdfFileNames,
} from "../fabrication/exportProjectFiles";
import { projectPdfListIncludesFerragensTotais } from "../fabrication/buildProjectPdfList";

vi.mock("../industrial/industrialBottomSectionData", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../industrial/industrialBottomSectionData")>();
  return {
    ...actual,
    buildFerragensTotaisArmazemData: () => ({
      materiaisChapas: [
        {
          material: "MDF Branco",
          ref: "mdf_branco",
          medida: "2800\u00d72070\u00d719 mm",
          quantidade: 3,
        },
      ],
      ferragens: [
        { material: "Cavilha 10mm", ref: "cavilha_10x40", medida: "\u00d810mm", quantidade: 16 },
        { material: "Corredica Lateral Esquerda", ref: "corredica_esq", medida: "", quantidade: 2 },
        { material: "Corredica Lateral Direita", ref: "corredica_dir", medida: "", quantidade: 2 },
        { material: "Dobradica 35mm", ref: "dobradica_35mm", medida: "35mm", quantidade: 2 },
        { material: "Parafuso para Puxador", ref: "parafuso_puxador", medida: "M4", quantidade: 4 },
        { material: "Prego para Costa", ref: "prego_costa", medida: "2mm", quantidade: 12 },
        { material: "Suporte de Prateleira", ref: "suporte_prateleira", medida: "", quantidade: 4 },
      ],
    }),
  };
});

function mockCups(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    x: 20,
    y: 100 + i * 200,
    diameter: 35,
    depth: 13,
    holeType: "dobradica" as const,
  }));
}

vi.mock("../fabrication/buildCutlistItemsForIndustrialExport", () => ({
  buildCutlistItemsForIndustrialExport: () => [
    { tipo: "COSTA", dimensoes: { largura: 720, altura: 560 }, quantidade: 1 },
    // ANTUNIS-like: 2+2+2+3+4 = 13 canecos
    { tipo: "porta_simples", dimensoes: { largura: 598, altura: 758 }, quantidade: 1, drillHoles: mockCups(2), boxId: "b1" },
    { tipo: "porta_simples", dimensoes: { largura: 598, altura: 758 }, quantidade: 1, drillHoles: mockCups(2), boxId: "b2" },
    { tipo: "porta_simples", dimensoes: { largura: 598, altura: 758 }, quantidade: 1, drillHoles: mockCups(2), boxId: "b3" },
    { tipo: "porta_simples", dimensoes: { largura: 598, altura: 918 }, quantidade: 1, drillHoles: mockCups(3), boxId: "b4" },
    { tipo: "porta_simples", dimensoes: { largura: 598, altura: 2398 }, quantidade: 1, drillHoles: mockCups(4), boxId: "b5" },
  ],
}));

describe("buildFerragensTotaisPdf", () => {
  it("gera PDF landscape com duas seccoes e colunas completas", () => {
    const doc = buildFerragensTotaisPdf(
      {
        boxes: [
          {
            id: "b1",
            gavetas: 1,
            dimensoes: { largura: 600, altura: 720, profundidade: 450 },
          } as never,
        ],
        rules: {} as never,
        materialId: undefined,
        projectName: "Projeto Teste",
        remates: [],
        rodapes: [],
        extractedPartsByBoxId: {},
        pieceObservacoes: {},
      },
      [] as ComponentType[],
      [] as Ferragem[],
      [] as MaterialIndustrial[]
    );
    expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(doc.internal.pageSize.getHeight());
    expect(doc.getNumberOfPages()).toBe(1);
    expect(ferragensTotaisPdfFileName("Projeto Teste")).toBe("Projeto_Teste_ferragens_totais.pdf");
    expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(500);
  });

  it("chapas: design original + Data; Preco/Responsavel vazios como no original", () => {
    const rows = chapasRowsForFerragensTotaisPdf([
      {
        material: "MDF Branco",
        ref: "mdf_branco",
        medida: "2800\u00d72070\u00d719 mm",
        quantidade: 3,
      },
    ]);
    expect(rows).toEqual([
      ["MDF Branco", "mdf_branco", "2800\u00d72070\u00d719 mm", "3", "", "__/__/__", "", ""],
    ]);
  });

  it("ferragens: Preco total = unitario x qtd; Responsavel vazio", () => {
    const rows = ferragensRowsForFerragensTotaisPdf([
      {
        material: "P\u00e9",
        ref: "P\u00e9-Pl\u00e1stico",
        medida: "100mm",
        quantidade: 4,
        preco: 2.8,
      },
      {
        material: "Dobradi\u00e7a",
        ref: "I-Sensys 8645i",
        medida: "35mm",
        quantidade: 13,
      },
    ]);
    expect(rows).toEqual([
      ["P\u00e9", "P\u00e9-Pl\u00e1stico", "100mm", "4", "11.20\u20ac", "", ""],
      ["Dobradi\u00e7a", "I-Sensys 8645i", "35mm", "13", "", "", ""],
    ]);
  });

  it("ferragens_totais esta na lista de exportacao (nao substituido por industrial_armazem)", () => {
    expect(projectPdfListIncludesFerragensTotais("Projeto Teste")).toBe(true);
    expect(assertFerragensTotaisInExport("Projeto Teste")).toBe("Projeto_Teste_ferragens_totais.pdf");
    const names = exportProjectPdfFileNames("Projeto Teste");
    expect(names).toContain("Projeto_Teste_ferragens_totais.pdf");
    expect(names).toContain("Projeto_Teste_industrial_armazem.pdf");
    expect(names.filter((n) => n.endsWith("_ferragens_totais.pdf"))).toHaveLength(1);
  });

  it("PDF usa 13 dobradicas (canecos) e ignora qty industrial 2", () => {
    const rows = normalizeFerragensTotaisForPdf({
      ferragens: [{ material: "Dobradica 35mm", ref: "dobradica_35mm", medida: "35mm", quantidade: 2 }],
      cutlistItems: [
        { tipo: "porta_simples", dimensoes: { largura: 598, altura: 758 }, quantidade: 1, drillHoles: mockCups(2) },
        { tipo: "porta_simples", dimensoes: { largura: 598, altura: 758 }, quantidade: 1, drillHoles: mockCups(2) },
        { tipo: "porta_simples", dimensoes: { largura: 598, altura: 758 }, quantidade: 1, drillHoles: mockCups(2) },
        { tipo: "porta_simples", dimensoes: { largura: 598, altura: 918 }, quantidade: 1, drillHoles: mockCups(3) },
        { tipo: "porta_simples", dimensoes: { largura: 598, altura: 2398 }, quantidade: 1, drillHoles: mockCups(4) },
      ],
      boxes: [],
    });
    expect(rows.find((r) => r.material === "Dobradi\u00e7a")?.quantidade).toBe(13);
  });
});
