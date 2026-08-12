/**
 * P3.19 — Asserts mínimos: Painéis + Financeiro sem €/chapa derivado na UI.
 */
import { describe, expect, it } from "vitest";
import { financeiroCustoRows } from "@/core/financeiro/financeiroUnificado";
import type { FinanceiroUnificadoSnapshot } from "@/core/financeiro/financeiroUnificadoTypes";
import { FINANCEIRO_CUSTO_KEYS } from "@/core/financeiro/financeiroUnificadoTypes";
import {
  applyPrecoPorM2Edit,
  recalcChapaDetalhe,
} from "./chapasReport";
import { snapshotToReportFinanceiro } from "./financeiroFromUnificado";
import {
  madeiraTotalFromFinanceiro,
  totalChapasDetalhe,
  withPaineisChapasDetalhe,
} from "./paineisChapasDetalhe";
import { makeReportId } from "./types";

const zeroCustos = Object.fromEntries(
  FINANCEIRO_CUSTO_KEYS.map((k) => [k, 0])
) as FinanceiroUnificadoSnapshot["custosEffective"];

function baseSnap(
  partial: Partial<FinanceiroUnificadoSnapshot> & {
    custosEffective: FinanceiroUnificadoSnapshot["custosEffective"];
  }
): FinanceiroUnificadoSnapshot {
  return {
    caixas: 1,
    pecasTotais: 4,
    areaTotalM2: 2,
    pesoTotalKg: 10,
    areaTotalMontadoM3: 0.5,
    chapas: { count: 2, mode: "real" },
    desperdicioTotalM2: 0,
    serragemTotalM2: 0,
    ferragensTotais: 0,
    orlaTotalM: 0,
    custosComputed: partial.custosEffective,
    custoKeysOverridden: [],
    ivaPct: 23,
    distanciaKm: 0,
    subtotal: 100,
    subtotalComAdmin: 100,
    ivaValor: 23,
    totalProjeto: 123,
    overrides: {},
    adminSettings: {} as FinanceiroUnificadoSnapshot["adminSettings"],
    ...partial,
  };
}

describe("P3.19 Financeiro ADMIN labels", () => {
  it("Painéis mostra custo total das chapas (sem linha Chapas reais)", () => {
    const snap = baseSnap({
      materialCostMode: "por_chapas_reais",
      chapasReaisMeta: {
        countMonetizado: 2,
        custoChapaDerived: 179.68,
        nestingMode: "real",
      },
      custosEffective: { ...zeroCustos, paineis: 0, chapasReais: 359.36 },
    });
    const rows = financeiroCustoRows(snap);
    const paineis = rows.find((r) => r.label === "Painéis");
    expect(paineis?.valor).toBe(359.36);
    expect(rows.some((r) => r.label.startsWith("Chapas reais"))).toBe(false);
    // UI não deve depender do texto €/chapa derivado — meta existe só no snap
    expect(snap.chapasReaisMeta?.custoChapaDerived).toBe(179.68);
  });
});

describe("P3.19 Painéis detalhe", () => {
  it("anexa chapas sem alterar totais Unificado", () => {
    const snap = baseSnap({
      custosEffective: { ...zeroCustos, paineis: 0, chapasReais: 200 },
      subtotal: 200,
      ivaValor: 46,
      totalProjeto: 246,
    });
    const fin = snapshotToReportFinanceiro(snap);
    const detalhe = [
      recalcChapaDetalhe({
        id: makeReportId("ch"),
        tipo: "MDF 19",
        dimensoes: "2800 x 2070 mm",
        comprimentoMm: 2800,
        larguraMm: 2070,
        espessuraMm: 19,
        quantidade: 2,
        precoPorM2: 31,
        precoPorMetro: 0,
        precoUnitario: 0,
        total: 0,
      }),
    ];
    const next = withPaineisChapasDetalhe(fin, detalhe);
    expect(next.subtotal).toBe(fin.subtotal);
    expect(next.ivaValor).toBe(fin.ivaValor);
    expect(next.totalProjeto).toBe(fin.totalProjeto);
    expect(next.linhas.find((l) => l.key === "paineis")?.detalhe?.length).toBe(1);
    expect(madeiraTotalFromFinanceiro(next)).toBe(200);
  });

  it("editar €/m² recalcula total da chapa", () => {
    const base = recalcChapaDetalhe({
      id: "x",
      tipo: "Chapa",
      dimensoes: "2800 x 2070 mm",
      comprimentoMm: 2800,
      larguraMm: 2070,
      espessuraMm: 19,
      quantidade: 1,
      precoPorM2: 20,
      precoPorMetro: 0,
      precoUnitario: 0,
      total: 0,
    });
    const edited = applyPrecoPorM2Edit(base, 40);
    expect(edited.precoPorM2).toBe(40);
    expect(edited.total).toBeGreaterThan(base.total);
    expect(totalChapasDetalhe([edited])).toBe(edited.total);
  });

  it("Total madeira Unificado = paineis + chapasReais (anti double-count)", () => {
    const snap = baseSnap({
      custosEffective: { ...zeroCustos, paineis: 0, chapasReais: 150 },
      subtotal: 150,
      ivaValor: 34.5,
      totalProjeto: 184.5,
    });
    const fin = snapshotToReportFinanceiro(snap);
    // Relatório: valor em Painéis; chapasReais linha = 0 (anti double-count UI)
    expect(fin.linhas.find((l) => l.key === "paineis")?.total).toBe(150);
    expect(fin.linhas.find((l) => l.key === "chapasReais")?.total).toBe(0);
    expect(madeiraTotalFromFinanceiro(fin)).toBe(150);
  });
});
