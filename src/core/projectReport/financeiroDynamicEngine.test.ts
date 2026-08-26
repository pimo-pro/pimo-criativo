/**
 * P3.27 — Motor dinâmico + paridade Antunes (SSOT intacto).
 */
import { describe, expect, it } from "vitest";
import {
  applyOverride,
  calcArea,
  calcChapa,
  createEmptyChapaDetalhe,
  createManualChapaDetalhe,
  emitTotalFinal,
  rebuildChapaDetalhe,
  setLinhaDetalheVisual,
  sumDetalheVisual,
  syncWithUnificado,
} from "./financeiroDynamicEngine";
import { snapshotToReportFinanceiro } from "./financeiroFromUnificado";
import { FINANCEIRO_CUSTO_KEYS } from "@/core/financeiro/financeiroUnificadoTypes";
import type { FinanceiroUnificadoSnapshot } from "@/core/financeiro/financeiroUnificadoTypes";

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

const ANTUNES = {
  paineis: 2874.88,
  gavetas: 45,
  ferragens: 275.64,
  orla: 134.13,
  iva: 831.16,
  totalProjeto: 4792.28,
};

function snapAntunes(): FinanceiroUnificadoSnapshot {
  const custos = Object.fromEntries(FINANCEIRO_CUSTO_KEYS.map((k) => [k, 0])) as Record<
    (typeof FINANCEIRO_CUSTO_KEYS)[number],
    number
  >;
  custos.chapasReais = ANTUNES.paineis;
  custos.gavetas = ANTUNES.gavetas;
  custos.ferragens = ANTUNES.ferragens;
  custos.orla = ANTUNES.orla;
  const subtotal = round2(ANTUNES.iva / 0.23);
  const known = ANTUNES.paineis + ANTUNES.gavetas + ANTUNES.ferragens + ANTUNES.orla;
  custos.operacoes = Math.max(0, round2(subtotal - known));
  const subtotalComAdmin = round2(ANTUNES.totalProjeto - ANTUNES.iva);
  custos.adm = round2(subtotalComAdmin - subtotal);
  return {
    caixas: 1,
    pecasTotais: 0,
    areaTotalM2: 0,
    pesoTotalKg: 0,
    areaTotalMontadoM3: 0,
    chapas: { count: 16, mode: "real" },
    desperdicioTotalM2: 0,
    serragemTotalM2: 0,
    ferragensTotais: 0,
    orlaTotalM: 0,
    custosComputed: { ...custos },
    custosEffective: { ...custos },
    custoKeysOverridden: [],
    ivaPct: 23,
    distanciaKm: 0,
    subtotal,
    subtotalComAdmin,
    ivaValor: ANTUNES.iva,
    totalProjeto: ANTUNES.totalProjeto,
    overrides: {},
    adminSettings: {} as FinanceiroUnificadoSnapshot["adminSettings"],
    materialCostMode: "por_chapas_reais",
    chapasReaisMeta: {
      countMonetizado: 16,
      custoChapaDerived: 179.68,
      nestingMode: "real",
    },
  };
}

describe("financeiroDynamicEngine", () => {
  it("calcArea / calcChapa", () => {
    expect(calcArea(2800, 2070)).toBeCloseTo(5.796, 3);
    expect(calcChapa(5.796, 31)).toBe(179.68);
  });

  it("applyOverride", () => {
    expect(applyOverride(100, null)).toBe(100);
    expect(applyOverride(100, 50)).toBe(50);
  });

  it("createManualChapaDetalhe: sem fallback ao catálogo", () => {
    const row = createManualChapaDetalhe();
    expect(row.tipo).toBe("");
    expect(row.precoPorM2).toBe(0);
  });

  it("rebuildChapaDetalhe: alterar €/m² recalcula €/chapa e total", () => {
    const base = createEmptyChapaDetalhe({
      id: "m",
      label: "MDF",
      espessuraMm: 19,
      precoPorM2: 31,
      precoPorMetro: 0,
      medidaDefault: "2800 x 2070 mm",
      comprimentoMm: 2800,
      larguraMm: 2070,
    });
    const edited = rebuildChapaDetalhe(base, { precoPorM2: 40, quantidade: 2 });
    expect(edited.precoUnitario).toBe(calcChapa(calcArea(2800, 2070), 40));
    expect(edited.total).toBe(round2(2 * edited.precoUnitario));
  });

  it("rebuildChapaDetalhe: alterar comprimento/largura recalcula área → €/chapa → total", () => {
    const base = rebuildChapaDetalhe(createEmptyChapaDetalhe(null), {
      precoPorM2: 31,
      quantidade: 1,
      comprimentoMm: 2800,
      larguraMm: 2070,
    });
    const edited = rebuildChapaDetalhe(base, {
      comprimentoMm: 1400,
      larguraMm: 2070,
    });
    expect(edited.areaChapaM2).toBeCloseTo(calcArea(1400, 2070), 3);
    expect(edited.precoUnitario).toBe(calcChapa(calcArea(1400, 2070), 31));
    expect(edited.total).toBe(edited.precoUnitario);
  });

  it("Antunes: Painéis oficial intacto após editar detalhe visual", () => {
    const snap = snapAntunes();
    let fin = snapshotToReportFinanceiro(snap);
    expect(fin.linhas.find((l) => l.key === "paineis")?.total).toBe(ANTUNES.paineis);
    expect(fin.officialSnapshot?.paineis).toBe(ANTUNES.paineis);

    const chapa = rebuildChapaDetalhe(createEmptyChapaDetalhe(null), {
      precoPorM2: 43.75,
      quantidade: 16,
      comprimentoMm: 2800,
      larguraMm: 2070,
    });
    fin = setLinhaDetalheVisual(fin, "paineis", [chapa], true);
    expect(fin.linhas.find((l) => l.key === "paineis")?.total).toBe(ANTUNES.paineis);
    expect(sumDetalheVisual(fin.linhas.find((l) => l.key === "paineis")!.detalhe)).toBeGreaterThan(
      ANTUNES.paineis
    );
    expect(fin.totalProjeto).toBe(ANTUNES.totalProjeto);
    expect(fin.ivaValor).toBe(ANTUNES.iva);
  });

  it("emitTotalFinal: sem overrides = ADMIN; com override muda só apresentação", () => {
    const snap = snapAntunes();
    const fin = snapshotToReportFinanceiro(snap);
    const official = syncWithUnificado(fin);
    const base = emitTotalFinal(official, null, 23);
    expect(base.totalProjeto).toBe(ANTUNES.totalProjeto);
    expect(base.hasOverrides).toBe(false);

    const withOv = emitTotalFinal(official, { paineis: 3000 }, 23);
    expect(withOv.hasOverrides).toBe(true);
    expect(withOv.totalProjeto).not.toBe(ANTUNES.totalProjeto);
    expect(withOv.official.totalProjeto).toBe(ANTUNES.totalProjeto);
  });
});
