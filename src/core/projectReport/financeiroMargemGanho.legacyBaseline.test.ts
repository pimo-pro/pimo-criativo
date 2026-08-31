/**
 * Passo C (opção B) — baseline legacy: sem margemGanho, iva/total inalterados.
 * Este ficheiro corre ANTES e DEPOIS do Passo C; deve permanecer verde.
 */
import { describe, expect, it } from "vitest";
import { computeFinanceiroUnificado } from "@/core/financeiro/financeiroUnificado";
import type { FinanceiroUnificadoSnapshot } from "@/core/financeiro/financeiroUnificadoTypes";
import { defaultRulesConfig } from "@/core/rules/rulesConfig";
import type { BoxModule } from "@/core/types";
import { applyReportLineOverrides } from "./financeiroOverrides";
import { recalcFinanceiro } from "./financeReportCalc";
import {
  buildLiveReportFinanceiro,
  snapshotToReportFinanceiro,
} from "./financeiroFromUnificado";

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function projectFixture(name: string, gavetas = 0) {
  const box = {
    id: "b1",
    nome: "Caixa",
    dimensoes: { largura: 600, altura: 720, profundidade: 560 },
    espessura: 19,
    portaTipo: "sem_porta",
    gavetas,
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
    projectName: name,
    remates: [],
    rodapes: [],
    workspaceBoxes: [],
    financeiroOverrides: { ivaPct: 23, custos: { adm: 50 } },
  };
}

/** Baseline pré-Passo-C: totais esperados sem margem (espelho ADMIN). */
function expectLegacyAdminParity(
  fin: { ivaValor: number; totalProjeto: number; subtotal: number; margemGanho?: unknown },
  snap: Pick<FinanceiroUnificadoSnapshot, "subtotal" | "ivaValor" | "totalProjeto">
) {
  expect(fin.margemGanho).toBeUndefined();
  expect(fin.subtotal).toBe(round2(snap.subtotal));
  expect(fin.ivaValor).toBe(round2(snap.ivaValor));
  // Unificado arredonda só no fim; o Relatório (finalize) arredonda parcelas → ±0.01 possível.
  expect(Math.abs(fin.totalProjeto - round2(snap.totalProjeto))).toBeLessThanOrEqual(0.01);
}

describe("margemGanho legacy baseline (opção B)", () => {
  it("projeto real paramétrico: buildLiveReportFinanceiro == ADMIN (sem margemGanho)", () => {
    const project = projectFixture("margem-legacy-baseline-live");
    const snap = computeFinanceiroUnificado(project);
    const report = buildLiveReportFinanceiro(project as never, []);
    expectLegacyAdminParity(report, snap);
  });

  it("projeto real paramétrico: snapshotToReportFinanceiro == ADMIN (sem margemGanho)", () => {
    const project = projectFixture("margem-legacy-baseline-snap");
    const snap = computeFinanceiroUnificado(project);
    const report = snapshotToReportFinanceiro(snap);
    expectLegacyAdminParity(report, snap);
  });

  it("applyReportLineOverrides vazio: totais == ADMIN (sem margemGanho)", () => {
    const project = projectFixture("margem-legacy-baseline-ov");
    const snap = computeFinanceiroUnificado(project);
    const base = snapshotToReportFinanceiro(snap);
    const fin = applyReportLineOverrides(base, {});
    expectLegacyAdminParity(fin, snap);
  });

  it("recalcFinanceiro após snapshot: totais legacy == relatório pós-finalize", () => {
    const project = projectFixture("margem-legacy-baseline-recalc", 2);
    const snap = computeFinanceiroUnificado(project);
    const base = snapshotToReportFinanceiro(snap);
    const fin = recalcFinanceiro(base);
    expect(fin.margemGanho).toBeUndefined();
    expect(fin.subtotal).toBe(base.subtotal);
    expect(fin.ivaValor).toBe(base.ivaValor);
    expect(fin.totalProjeto).toBe(base.totalProjeto);
    expectLegacyAdminParity(fin, snap);
  });

  it("baseline congelado: valores iva/total idênticos em todos os caminhos legacy", () => {
    const project = projectFixture("margem-legacy-baseline-freeze");
    const snap = computeFinanceiroUnificado(project);
    const paths = [
      buildLiveReportFinanceiro(project as never, []),
      snapshotToReportFinanceiro(snap),
      applyReportLineOverrides(snapshotToReportFinanceiro(snap), {}),
      recalcFinanceiro(snapshotToReportFinanceiro(snap)),
    ];
    for (const fin of paths) {
      expect(fin.ivaValor).toBe(round2(snap.ivaValor));
      expect(Math.abs(fin.totalProjeto - round2(snap.totalProjeto))).toBeLessThanOrEqual(0.01);
    }
  });
});
