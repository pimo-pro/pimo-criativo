import { describe, expect, it, vi } from "vitest";
import {
  collectPaineisSugestoesFromRelease,
  collectPaineisSugestoesProjeto,
  collectSugestoesFromCutlistTipos,
  collectSugestoesFromRemates,
  isCutlistNomeSugestaoSegura,
  labelFromRemateProductType,
} from "./paineisSugestoesProjeto";
import type { ProductionRelease } from "@/core/industrial/productionRelease";

vi.mock("./paineisChapasDetalhe", () => ({
  buildPaineisChapasDetalhe: () => [
    { tipo: "MDF Branco", id: "ch-1" },
  ],
}));

describe("paineisSugestoesProjeto (Fase 4)", () => {
  it("labelFromRemateProductType: TAMPO_COZINHA → TAMPO", () => {
    expect(labelFromRemateProductType("TAMPO_COZINHA")).toBe("TAMPO");
    expect(labelFromRemateProductType("RODAPE_L")).toBe("RODAPE");
  });

  it("inclui TAMPO a partir de remates (não só material de chapa)", () => {
    const state = {
      remates: [
        {
          id: "1",
          tipo: "TAMPO",
          productType: "TAMPO_COZINHA",
          width: 1,
          height: 1,
          depth: 1,
        },
      ],
      cutList: null,
      rodapes: [],
    } as never;
    const s = collectPaineisSugestoesProjeto("proj", state);
    expect(s).toContain("TAMPO");
    expect(s).toContain("MDF Branco"); // da fonte nesting mock
  });

  it("anti-ruído: rejeita medidas e códigos longos no nome da cutlist", () => {
    expect(isCutlistNomeSugestaoSegura("TAMPO")).toBe(true);
    expect(isCutlistNomeSugestaoSegura("LATERAL_ESQ")).toBe(true);
    expect(isCutlistNomeSugestaoSegura("2800 x 2070 mm")).toBe(false);
    expect(isCutlistNomeSugestaoSegura("Peca 12345 industrial")).toBe(false);
    expect(isCutlistNomeSugestaoSegura("abc123456")).toBe(false);
  });

  it("cutlist: usa tipo sempre; nome só se seguro", () => {
    const state = {
      cutList: [
        { id: "1", tipo: "prateleira", nome: "2800 x 500 mm", material: "MDF" },
        { id: "2", tipo: "", nome: "COSTA", material: "MDF" },
        { id: "3", tipo: "lateral", nome: "Lateral esquerda detalhada com texto", material: "MDF" },
      ],
    } as never;
    const s = collectSugestoesFromCutlistTipos(state);
    expect(s).toContain("prateleira");
    expect(s).toContain("COSTA");
    expect(s).not.toContain("2800 x 500 mm");
    expect(s).not.toContain("Lateral esquerda detalhada com texto");
  });

  it("remates: tipo + productType sem duplicar TAMPO", () => {
    const s = collectSugestoesFromRemates([
      {
        id: "1",
        tipo: "TAMPO",
        productType: "TAMPO_COZINHA",
        width: 1,
        height: 1,
        depth: 1,
      } as never,
    ]);
    expect(s.filter((x) => x === "TAMPO")).toHaveLength(1);
  });

  it("F2: collectPaineisSugestoesFromRelease lê peças do release (inclui TAMPO)", () => {
    const release = {
      version: 1,
      generatedAt: "2026-08-27T10:00:00.000Z",
      projectId: "proj-1",
      chapas: {
        totalSheets: 1,
        totalWasteMm2: 0,
        totalWastePct: 0,
        sheets: [
          {
            sheetIndex: 1,
            espessuraMm: 19,
            material: "MDF Branco",
            sheetLarguraMm: 2800,
            sheetAlturaMm: 2070,
            pieceCount: 1,
            usedAreaMm2: 0,
            sheetAreaMm2: 0,
            wasteMm2: 0,
            wastePct: 0,
            pieces: [
              { nome: "TAMPO_COZINHA", boxId: "b1", nQr: "1", largura: 1, altura: 1 },
            ],
          },
        ],
        mode: "oficial_pro",
        diagnostics: [],
      },
      ferragens: { totalEur: 0, totalQty: 0, lines: [] },
    } as ProductionRelease;
    const s = collectPaineisSugestoesFromRelease(release);
    expect(s).toContain("TAMPO");
    expect(s).toContain("MDF Branco");
    expect(collectPaineisSugestoesFromRelease(null)).toEqual([]);
  });
});
