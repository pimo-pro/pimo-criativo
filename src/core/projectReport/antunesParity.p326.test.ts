/**
 * P3.26 — Paridade ADMIN ↔ Relatório Final (cenário Antunes_Novo_Cozinha).
 * Valores-alvo reportados na auditoria; detalhe legado 16×253.58 não pode vencer o SSOT.
 */
import { describe, expect, it } from "vitest";
import { FINANCEIRO_CUSTO_KEYS } from "@/core/financeiro/financeiroUnificadoTypes";
import type { FinanceiroUnificadoSnapshot } from "@/core/financeiro/financeiroUnificadoTypes";
import { snapshotToReportFinanceiro } from "./financeiroFromUnificado";
import {
  applyReportLineOverrides,
  officialPaineisTotal,
  resolvePaineisOrigem,
} from "./financeiroOverrides";
import { withPaineisChapasDetalhe } from "./paineisChapasDetalhe";
import { alignOfficialTotalsToUnificado } from "./financeiroTotals";
import { ensureFinanceiroShape, recalcFinanceiro } from "./financeReportCalc";

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

const ANTUNES = {
  paineis: 2874.88,
  portas: 0,
  gavetas: 45,
  ferragens: 275.64,
  orla: 134.13,
  iva: 831.16,
  totalProjeto: 4792.28,
};

function snapFromAntunes(): FinanceiroUnificadoSnapshot {
  const custos = Object.fromEntries(FINANCEIRO_CUSTO_KEYS.map((k) => [k, 0])) as Record<
    (typeof FINANCEIRO_CUSTO_KEYS)[number],
    number
  >;
  // Madeira nas chapas reais (Painéis UI = paineis + chapasReais)
  custos.paineis = 0;
  custos.chapasReais = ANTUNES.paineis;
  custos.portas = 0;
  custos.remates = 0;
  custos.gavetas = ANTUNES.gavetas;
  custos.ferragens = ANTUNES.ferragens;
  custos.orla = ANTUNES.orla;

  // Reconstruir subtotal materiais a partir do IVA reportado (23%)
  const subtotal = round2(ANTUNES.iva / 0.23);
  // Resto do subtotal (ops, desperdício, etc.)
  const known =
    ANTUNES.paineis + ANTUNES.gavetas + ANTUNES.ferragens + ANTUNES.orla;
  const resto = round2(subtotal - known);
  custos.operacoes = Math.max(0, resto);

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

describe("P3.26 Antunes — paridade ADMIN ↔ Relatório", () => {
  it("snapshotToReportFinanceiro: Painéis / IVA / Total iguais ao ADMIN", () => {
    const snap = snapFromAntunes();
    expect(officialPaineisTotal(snap)).toBe(ANTUNES.paineis);
    expect(resolvePaineisOrigem(snap)).toBe("chapas_reais_m2_area");

    const report = snapshotToReportFinanceiro(snap);
    expect(report.linhas.find((l) => l.key === "paineis")?.total).toBe(ANTUNES.paineis);
    expect(report.linhas.find((l) => l.key === "chapasReais")?.total).toBe(0);
    expect(report.linhas.find((l) => l.key === "portas")?.total).toBe(0);
    expect(report.linhas.find((l) => l.key === "remates")?.total).toBe(0);
    expect(report.linhas.find((l) => l.key === "gavetas")?.total).toBe(ANTUNES.gavetas);
    expect(report.ivaValor).toBe(ANTUNES.iva);
    expect(report.totalProjeto).toBe(ANTUNES.totalProjeto);
    expect(report.paineisOrigem).toBe("chapas_reais_m2_area");
  });

  it("detalhe legado 16×253.58 NÃO altera total Painéis", () => {
    const snap = snapFromAntunes();
    let fin = snapshotToReportFinanceiro(snap);
    fin = withPaineisChapasDetalhe(fin, [
      {
        id: "leg",
        tipo: "MDF",
        dimensoes: "2800 x 2070 mm",
        comprimentoMm: 2800,
        larguraMm: 2070,
        espessuraMm: 19,
        quantidade: 16,
        precoPorM2: 43.75,
        precoUnitario: 253.58,
        total: 4057.28,
      },
    ]);
    fin = recalcFinanceiro(fin);
    expect(fin.linhas.find((l) => l.key === "paineis")?.total).toBe(ANTUNES.paineis);
    expect(fin.totalProjeto).toBe(ANTUNES.totalProjeto);
    expect(fin.ivaValor).toBe(ANTUNES.iva);
  });

  it("alignOfficialTotals limpa qtd/unit inconsistentes", () => {
    const fin = ensureFinanceiroShape(null, { paineis: 4057.24 });
    const dirty = {
      ...fin,
      linhas: fin.linhas.map((l) =>
        l.key === "paineis"
          ? {
              ...l,
              quantidade: 16,
              precoUnitario: 253.58,
              total: 4057.24,
              detalhe: [
                {
                  id: "x",
                  tipo: "MDF",
                  dimensoes: "2800 x 2070 mm",
                  quantidade: 16,
                  precoUnitario: 253.58,
                  total: 4057.24,
                },
              ],
            }
          : l
      ),
    };
    // Sem state: financeiroTotals + recalcLinha locked
    const cleaned = recalcFinanceiro(dirty);
    const row = cleaned.linhas.find((l) => l.key === "paineis");
    expect(row?.quantidade).toBeNull();
    expect(row?.precoUnitario).toBeNull();
    // total preservado do valor locked (4057.24 neste fixture sem Unificado)
    expect(row?.total).toBe(4057.24);
  });

  it("override manual não usa detalhe; portas/remates ficam 0", () => {
    const snap = snapFromAntunes();
    const base = snapshotToReportFinanceiro(snap);
    const overridden = applyReportLineOverrides(base, {
      paineis: 3000,
      portas: 999,
      remates: 999,
    });
    expect(overridden.linhas.find((l) => l.key === "paineis")?.total).toBe(3000);
    expect(overridden.linhas.find((l) => l.key === "portas")?.total).toBe(0);
    expect(overridden.linhas.find((l) => l.key === "remates")?.total).toBe(0);
  });
});

describe("alignOfficialTotalsToUnificado — sem state", () => {
  it("fallback seguro", () => {
    const fin = ensureFinanceiroShape(null, { paineis: 10 });
    const next = alignOfficialTotalsToUnificado(fin, null, []);
    expect(next.linhas.find((l) => l.key === "paineis")?.total).toBe(10);
  });
});
