/**
 * P3.28 — Motor visual de Ferragens (SSOT Unificado intacto).
 */
import { describe, expect, it } from "vitest";
import {
  applyOverride,
  buildFerragensVisual,
  collectUnificadoFerragens,
  calcTotal,
  createEmptyFerragemDetalhe,
  emitFerragensTotalVisual,
  listCatalogoFerragens,
  patchFerragemNome,
  persistFerragensVisual,
  rebuildFerragemDetalhe,
  visualToDetalhe,
  type FerragemUnificadoLine,
} from "./financeiroFerragensEngine";
import { snapshotToReportFinanceiro } from "./financeiroFromUnificado";
import { computeFinanceiroUnificado } from "@/core/financeiro/financeiroUnificado";
import { defaultRulesConfig } from "@/core/rules/rulesConfig";
import type { BoxModule } from "@/core/types";
import { FINANCEIRO_CUSTO_KEYS } from "@/core/financeiro/financeiroUnificadoTypes";
import type { FinanceiroUnificadoSnapshot } from "@/core/financeiro/financeiroUnificadoTypes";

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function twelveLines(): FerragemUnificadoLine[] {
  return Array.from({ length: 12 }, (_, i) => {
    const quantidade = i + 1;
    const precoUnitario = 0.5 + i * 0.1;
    return {
      ferragemId: `f${i + 1}`,
      nome: `Ferragem ${i + 1}`,
      quantidade,
      precoUnitario,
      precoTotal: calcTotal(quantidade, precoUnitario),
      observacoes: `${i + 1} mm`,
      origemPreco: "catalogo" as const,
    };
  });
}

function snapFerragens(total: number): FinanceiroUnificadoSnapshot {
  const custos = Object.fromEntries(FINANCEIRO_CUSTO_KEYS.map((k) => [k, 0])) as Record<
    (typeof FINANCEIRO_CUSTO_KEYS)[number],
    number
  >;
  custos.ferragens = total;
  return {
    caixas: 1,
    pecasTotais: 0,
    areaTotalM2: 0,
    pesoTotalKg: 0,
    areaTotalMontadoM3: 0,
    chapas: { count: 0, mode: "estimado" },
    desperdicioTotalM2: 0,
    serragemTotalM2: 0,
    ferragensTotais: 12,
    orlaTotalM: 0,
    custosComputed: { ...custos },
    custosEffective: { ...custos },
    custoKeysOverridden: [],
    ivaPct: 23,
    distanciaKm: 0,
    subtotal: total,
    subtotalComAdmin: total,
    ivaValor: round2(total * 0.23),
    totalProjeto: round2(total * 1.23),
    overrides: {},
    adminSettings: {} as FinanceiroUnificadoSnapshot["adminSettings"],
    materialCostMode: "por_peca",
  };
}

describe("P3.28 financeiroFerragensEngine", () => {
  it("calcTotal = quantidade × preço unitário", () => {
    expect(calcTotal(4, 2.5)).toBe(10);
    expect(calcTotal(0, 9)).toBe(0);
  });

  it("applyOverride: nulo mantém base; número substitui", () => {
    expect(applyOverride(10, null)).toBe(10);
    expect(applyOverride(10, 3.5)).toBe(3.5);
  });

  it("buildFerragensVisual: lista completa (mínimo 12 itens)", () => {
    const visual = buildFerragensVisual(twelveLines(), {});
    expect(visual.length).toBe(12);
    expect(visual[0]?.tipo).toBe("Ferragem 1");
    expect(visual[0]?.total).toBe(calcTotal(1, 0.5));
  });

  it("editar quantidade recalcula total visual", () => {
    const row = visualToDetalhe(buildFerragensVisual(twelveLines(), {}))[0]!;
    const edited = rebuildFerragemDetalhe(row, { quantidade: 10 });
    expect(edited.total).toBe(calcTotal(10, row.precoUnitario));
  });

  it("override de preço unitário e item adicionado", () => {
    const visual = buildFerragensVisual(twelveLines(), {
      "ferr-f1": { precoUnitario: 9 },
      extra: { added: true, tipo: "Nova", quantidade: 2, precoUnitario: 3 },
    });
    expect(visual.find((v) => v.id === "ferr-f1")?.isOverride).toBe(true);
    expect(visual.find((v) => v.id === "ferr-f1")?.precoUnitario).toBe(9);
    expect(visual.find((v) => v.id === "extra")?.total).toBe(6);
    expect(emitFerragensTotalVisual(visual)).toBeGreaterThan(
      emitFerragensTotalVisual(buildFerragensVisual(twelveLines(), {}))
    );
  });

  it("persistFerragensVisual não altera o SSOT oficial", () => {
    const official = 275.64;
    let fin = snapshotToReportFinanceiro(snapFerragens(official));
    expect(fin.officialSnapshot?.ferragens).toBe(official);
    const detalhe = visualToDetalhe(buildFerragensVisual(twelveLines(), {}));
    fin = persistFerragensVisual(fin, detalhe, twelveLines());
    expect(fin.linhas.find((l) => l.key === "ferragens")?.total).toBe(official);
    expect(fin.officialSnapshot?.ferragens).toBe(official);
    expect(fin.linhas.find((l) => l.key === "ferragens")?.detalhe.length).toBe(12);
    const visual = emitFerragensTotalVisual(detalhe);
    expect(visual).not.toBe(official);
    expect(Object.keys(fin.overrides?.ferragens ?? {}).length).toBeGreaterThanOrEqual(0);
  });

  it("paridade: collectUnificadoFerragens === custosEffective.ferragens (sem overrides)", () => {
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
    const project = {
      boxes: [box],
      rules: defaultRulesConfig,
      materialId: "mdf_branco",
      projectName: "ferragens-report-parity",
      remates: [],
      rodapes: [],
      workspaceBoxes: [],
    };
    const snap = computeFinanceiroUnificado(project);
    const lines = collectUnificadoFerragens(project as never);
    const visual = buildFerragensVisual(lines, {});
    const sum = emitFerragensTotalVisual(visual);
    expect(sum).toBe(round2(snap.custosEffective.ferragens || 0));
    expect(lines.length).toBeGreaterThan(0);
  });

  it("createEmptyFerragemDetalhe manual: linha vazia sem catálogo", () => {
    const row = createEmptyFerragemDetalhe(null, { manual: true });
    expect(row.tipo).toBe("");
    expect(row.precoUnitario).toBe(0);
  });

  it("patchFerragemNome: catálogo vs manual", () => {
    const catalog = listCatalogoFerragens();
    expect(catalog.length).toBeGreaterThan(0);
    const base = createEmptyFerragemDetalhe(null, { manual: true });
    const fromCat = patchFerragemNome(base, catalog[0]!.nome, catalog);
    expect(fromCat.precoUnitario).toBeGreaterThanOrEqual(0);
    const manual = patchFerragemNome(base, "Parafuso especial XYZ", catalog);
    expect(manual.tipo).toBe("Parafuso especial XYZ");
    expect(manual.ferragemId).toBe(base.id);
  });
});
