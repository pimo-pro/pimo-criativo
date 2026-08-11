/**
 * P3.17 — Alinhamento Relatório Final ↔ Financeiro Unificado (ADMIN).
 */
import { describe, expect, it } from "vitest";
import { computeFinanceiroUnificado } from "@/core/financeiro/financeiroUnificado";
import type { FinanceiroUnificadoSnapshot } from "@/core/financeiro/financeiroUnificadoTypes";
import { FINANCEIRO_CUSTO_KEYS } from "@/core/financeiro/financeiroUnificadoTypes";
import { defaultRulesConfig } from "@/core/rules/rulesConfig";
import type { BoxModule } from "@/core/types";
import {
  buildLiveReportFinanceiro,
  snapshotToReportFinanceiro,
} from "./financeiroFromUnificado";

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function minimalSnap(
  patch: Partial<FinanceiroUnificadoSnapshot> & {
    custosEffective: FinanceiroUnificadoSnapshot["custosEffective"];
  }
): FinanceiroUnificadoSnapshot {
  return {
    caixas: 1,
    pecasTotais: 0,
    areaTotalM2: 0,
    pesoTotalKg: 0,
    areaTotalMontadoM3: 0,
    chapas: { count: 0, mode: "estimado" },
    custosBase: patch.custosEffective,
    custosEffective: patch.custosEffective,
    ivaPct: patch.ivaPct ?? 23,
    subtotal: patch.subtotal ?? 0,
    ivaValor: patch.ivaValor ?? 0,
    totalProjeto: patch.totalProjeto ?? 0,
    subtotalComAdmin: patch.subtotalComAdmin ?? patch.totalProjeto ?? 0,
    ...patch,
  };
}

describe("snapshotToReportFinanceiro", () => {
  it("copia totalProjeto e ivaValor do snap", () => {
    const custos = Object.fromEntries(FINANCEIRO_CUSTO_KEYS.map((k) => [k, 0])) as Record<
      (typeof FINANCEIRO_CUSTO_KEYS)[number],
      number
    >;
    custos.paineis = 100;
    custos.adm = 40;
    const snap = minimalSnap({
      custosEffective: custos,
      subtotal: 100,
      ivaPct: 23,
      ivaValor: 23,
      totalProjeto: 163,
    });
    const report = snapshotToReportFinanceiro(snap);
    expect(report.subtotal).toBe(100);
    expect(report.ivaValor).toBe(23);
    expect(report.totalProjeto).toBe(163);
    expect(report.linhas.find((l) => l.key === "paineis")?.total).toBe(100);
    expect(report.linhas.find((l) => l.key === "adm")?.total).toBe(40);
    expect(report.linhas.find((l) => l.key === "iva")?.total).toBe(23);
    expect(report.linhas.find((l) => l.key === "total")?.total).toBe(163);
  });

  it("sem double-count: paineis 0 + chapasReais no total do snap", () => {
    const custos = Object.fromEntries(FINANCEIRO_CUSTO_KEYS.map((k) => [k, 0])) as Record<
      (typeof FINANCEIRO_CUSTO_KEYS)[number],
      number
    >;
    custos.paineis = 0;
    custos.chapasReais = 250;
    const snap = minimalSnap({
      custosEffective: custos,
      subtotal: 250,
      ivaPct: 23,
      ivaValor: round2(250 * 0.23),
      totalProjeto: round2(250 + 250 * 0.23),
    });
    const report = snapshotToReportFinanceiro(snap);
    expect(report.linhas.find((l) => l.key === "paineis")?.total).toBe(0);
    expect(report.linhas.find((l) => l.key === "chapasReais")?.total).toBe(250);
    expect(report.totalProjeto).toBe(snap.totalProjeto);
    expect(report.ivaValor).toBe(snap.ivaValor);
    // Detalhe vazio — nao reprecifica
    expect(report.linhas.every((l) => (l.detalhe?.length ?? 0) === 0)).toBe(true);
  });
});

describe("buildLiveReportFinanceiro vs Unificado", () => {
  it("financeiro live == Unificado (IVA nao inclui ADM)", () => {
    const box = {
      id: "b1",
      nome: "Caixa teste",
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
      projectName: "Teste P3.17",
      remates: [],
      rodapes: [],
      financeiroOverrides: {
        ivaPct: 23,
        custos: { adm: 50 },
      },
    };

    const snap = computeFinanceiroUnificado(project);
    const report = buildLiveReportFinanceiro(project as never, []);

    expect(report.subtotal).toBe(round2(snap.subtotal));
    expect(report.ivaValor).toBe(round2(snap.ivaValor));
    expect(report.totalProjeto).toBe(round2(snap.totalProjeto));
    expect(report.ivaPct).toBe(snap.ivaPct);

    // IVA so sobre materiais; ADM no effective e fora da base de IVA
    const adm = Number(snap.custosEffective.adm) || 0;
    expect(adm).toBe(50);
    expect(report.ivaValor).toBe(round2(snap.subtotal * (snap.ivaPct / 100)));
    expect(report.totalProjeto).toBe(round2(snap.subtotalComAdmin + snap.ivaValor));
    expect(report.totalProjeto).toBeGreaterThan(round2(snap.subtotal + report.ivaValor));

    for (const key of FINANCEIRO_CUSTO_KEYS) {
      const line = report.linhas.find((l) => l.key === key);
      expect(line?.total).toBe(round2(snap.custosEffective[key] ?? 0));
    }
  });
});
