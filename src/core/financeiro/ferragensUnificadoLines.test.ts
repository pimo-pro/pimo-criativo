/**
 * Paridade SSOT Ferragens: linhas agregadas = totais do Financeiro Unificado.
 */
import { describe, expect, it } from "vitest";
import { defaultRulesConfig } from "@/core/rules/rulesConfig";
import type { BoxModule } from "@/core/types";
import { computeFinanceiroUnificado } from "./financeiroUnificado";
import {
  aggregateFerragensCatalogLines,
  computeFerragensUnificadoSsot,
} from "./ferragensUnificadoLines";

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Fixture reutilizada de financeiroOriginalRestored.test.ts (caixa paramétrica mínima). */
function projectFixture() {
  const box = {
    id: "b1",
    nome: "Caixa",
    dimensoes: { largura: 600, altura: 720, profundidade: 560 },
    espessura: 19,
    portaTipo: "sem_porta",
    gavetas: 0,
    prateleiras: 1,
    doorsLayer: [],
    drawersLayer: [],
    costaAtiva: true,
    material: "mdf_branco",
  } as unknown as BoxModule;

  return {
    boxes: [box],
    rules: defaultRulesConfig,
    materialId: "mdf_branco",
    projectName: "ferragens-ssot-parity",
    remates: [],
    rodapes: [],
    workspaceBoxes: [],
  };
}

describe("ferragensUnificadoLines", () => {
  it("agrega por ferragemId com preço médio ponderado", () => {
    const lines = aggregateFerragensCatalogLines([
      {
        pieceId: "p1",
        ferragemId: "dobradica_35mm",
        qtd: 2,
        precoUnitario: 2.5,
        precoTotal: 5,
        usedFallbackA: false,
      },
      {
        pieceId: "p2",
        ferragemId: "dobradica_35mm",
        qtd: 4,
        precoUnitario: 3,
        precoTotal: 12,
        usedFallbackA: false,
      },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.quantidade).toBe(6);
    expect(lines[0]!.precoTotal).toBe(17);
    expect(lines[0]!.precoUnitario).toBeCloseTo(17 / 6, 2);
  });

  it("sum(lines.precoTotal) === totalEur do SSOT", () => {
    const project = projectFixture();
    const ssot = computeFerragensUnificadoSsot(project);
    const sumLines = round2(ssot.lines.reduce((s, l) => s + l.precoTotal, 0));
    expect(sumLines).toBe(ssot.totalEur);
    expect(ssot.lines.length).toBeGreaterThan(0);
  });

  it("paridade com computeFinanceiroUnificado.custosEffective.ferragens", () => {
    const project = projectFixture();
    const snap = computeFinanceiroUnificado(project);
    const ssot = computeFerragensUnificadoSsot(project);

    expect(ssot.totalEur).toBe(round2(snap.custosEffective.ferragens || 0));
    expect(ssot.totalQty).toBe(snap.ferragensTotais);

    const sumLines = round2(ssot.lines.reduce((s, l) => s + l.precoTotal, 0));
    expect(sumLines).toBe(round2(snap.custosEffective.ferragens || 0));
  });
});
