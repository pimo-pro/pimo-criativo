import { describe, expect, it } from "vitest";
import { FINANCEIRO_CUSTO_KEYS } from "@/core/financeiro/financeiroUnificadoTypes";
import {
  calcReportTotals,
  effectiveMargemPercentagem,
  finalizeReportFinanceiro,
  setReportMargemGanho,
} from "./financeiroMargemGanho";
import { snapshotToReportFinanceiro } from "./financeiroFromUnificado";
import { FINANCEIRO_REPORT_LABELS, type ProjectReportFinanceiro } from "./types";

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function finComTotais(totals: Partial<Record<string, number>>): ProjectReportFinanceiro {
  const linhas = FINANCEIRO_CUSTO_KEYS.map((key) => ({
    key,
    label: FINANCEIRO_REPORT_LABELS[key],
    quantidade: null,
    precoUnitario: null,
    total: round2(Number(totals[key]) || 0),
    detalhe: [],
  }));
  return finalizeReportFinanceiro({
    ivaPct: 23,
    linhas,
    subtotal: 0,
    ivaValor: 0,
    totalProjeto: 0,
  });
}

describe("financeiroMargemGanho — margem > 0", () => {
  it("10% sobre base 1000 → IVA 23% sobre 1100 → total 1353", () => {
    const map = new Map<string, number>([["paineis", 1000]]);
    for (const key of FINANCEIRO_CUSTO_KEYS) {
      if (!map.has(key)) map.set(key, 0);
    }
    const result = calcReportTotals(map, 23, { mode: "percentagem", percentagem: 10 });
    expect(result.margemValor).toBe(100);
    expect(result.ivaValor).toBe(253);
    expect(result.totalProjeto).toBe(1353);
  });

  it("100€ fixo sobre base 1000 → equivalente 10%", () => {
    const pct = effectiveMargemPercentagem(
      { mode: "valorFixo", percentagem: 0, valorFixo: 100 },
      1000
    );
    expect(pct).toBe(10);

    const map = new Map<string, number>([
      ["paineis", 800],
      ["adm", 200],
    ]);
    for (const key of FINANCEIRO_CUSTO_KEYS) {
      if (!map.has(key)) map.set(key, 0);
    }
    const result = calcReportTotals(map, 23, {
      mode: "valorFixo",
      percentagem: 10,
      valorFixo: 100,
    });
    expect(result.margemValor).toBe(100);
    expect(result.ivaValor).toBe(253);
    expect(result.totalProjeto).toBe(1353);
  });

  it("linha margemGanho fica imediatamente antes de IVA", () => {
    const fin = setReportMargemGanho(finComTotais({ paineis: 1000 }), {
      mode: "percentagem",
      percentagem: 10,
    });
    const keys = fin.linhas.map((l) => l.key);
    const margemIdx = keys.indexOf("margemGanho");
    const ivaIdx = keys.indexOf("iva");
    expect(margemIdx).toBeGreaterThan(-1);
    expect(ivaIdx).toBe(margemIdx + 1);
    expect(fin.linhas[margemIdx]?.label).toContain("10%");
  });

  it("margem 0/ausente mantém fórmula legacy (IVA só materiais)", () => {
    const finLegacy = finComTotais({ paineis: 100, adm: 50 });
    expect(finLegacy.ivaValor).toBe(23);
    expect(finLegacy.totalProjeto).toBe(173);

    const finZero = setReportMargemGanho(finLegacy, {
      mode: "percentagem",
      percentagem: 0,
    });
    expect(finZero.ivaValor).toBe(23);
    expect(finZero.totalProjeto).toBe(173);
    expect(finZero.margemGanho?.percentagem).toBe(0);
  });

  it("snapshot sem margem: finalize não altera totais ADMIN", () => {
    const snap = {
      subtotal: 100,
      ivaValor: 23,
      totalProjeto: 173,
      ivaPct: 23,
      custosEffective: Object.fromEntries(FINANCEIRO_CUSTO_KEYS.map((k) => [k, k === "paineis" ? 100 : k === "adm" ? 50 : 0])),
    } as never;
    const report = snapshotToReportFinanceiro(snap);
    expect(report.ivaValor).toBe(23);
    expect(report.totalProjeto).toBe(173);
    expect(report.margemGanho).toBeUndefined();
  });
});
