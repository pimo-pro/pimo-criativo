/**
 * P3.25 — Relatório Final = SSOT Unificado (ADMIN), sem recalculo interno.
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

describe("P3.25 snapshotToReportFinanceiro SSOT", () => {
  it("copia subtotal / IVA / total do ADMIN", () => {
    const custos = Object.fromEntries(FINANCEIRO_CUSTO_KEYS.map((k) => [k, 0])) as Record<
      (typeof FINANCEIRO_CUSTO_KEYS)[number],
      number
    >;
    custos.paineis = 100;
    custos.ferragens = 20;
    custos.orla = 10;
    custos.adm = 40;
    const snap = minimalSnap({
      custosEffective: custos,
      subtotal: 130,
      ivaPct: 23,
      ivaValor: round2(130 * 0.23),
      totalProjeto: round2(130 + 40 + 130 * 0.23),
      subtotalComAdmin: 170,
    });
    const report = snapshotToReportFinanceiro(snap);
    expect(report.subtotal).toBe(snap.subtotal);
    expect(report.ivaValor).toBe(snap.ivaValor);
    expect(report.totalProjeto).toBe(snap.totalProjeto);
    expect(report.linhas.find((l) => l.key === "paineis")?.total).toBe(100);
    expect(report.linhas.find((l) => l.key === "ferragens")?.total).toBe(20);
    expect(report.linhas.find((l) => l.key === "orla")?.total).toBe(10);
    expect(report.linhas.find((l) => l.key === "adm")?.total).toBe(40);
    expect(report.linhas.every((l) => (l.detalhe?.length ?? 0) === 0)).toBe(true);
  });

  it("Painéis = paineis + chapasReais; chapasReais linha = 0 (sem duplicação)", () => {
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
    expect(report.linhas.find((l) => l.key === "paineis")?.total).toBe(250);
    expect(report.linhas.find((l) => l.key === "chapasReais")?.total).toBe(0);
    expect(report.totalProjeto).toBe(snap.totalProjeto);
  });
});

describe("P3.25 buildLiveReportFinanceiro == ADMIN", () => {
  it("Total / IVA / Subtotal / Painéis iguais ao Unificado", () => {
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
      projectName: "P3.25",
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

    const paineisAdmin = round2(
      (Number(snap.custosEffective.paineis) || 0) +
        (Number(snap.custosEffective.chapasReais) || 0)
    );
    expect(report.linhas.find((l) => l.key === "paineis")?.total).toBe(paineisAdmin);
    expect(report.linhas.find((l) => l.key === "chapasReais")?.total).toBe(0);
    expect(report.linhas.find((l) => l.key === "ferragens")?.total).toBe(
      round2(snap.custosEffective.ferragens)
    );
    expect(report.linhas.find((l) => l.key === "orla")?.total).toBe(
      round2(snap.custosEffective.orla)
    );
    expect(report.linhas.find((l) => l.key === "desperdicio")?.total).toBe(
      round2(snap.custosEffective.desperdicio)
    );
    expect(report.linhas.find((l) => l.key === "serragem")?.total).toBe(
      round2(snap.custosEffective.serragem)
    );
    expect(report.linhas.find((l) => l.key === "adm")?.total).toBe(
      round2(snap.custosEffective.adm)
    );
    expect(report.linhas.find((l) => l.key === "montagem")?.total).toBe(
      round2(snap.custosEffective.montagem)
    );

    // P3.28: detalhe visual de Ferragens permitido; totais continuam SSOT
    expect(
      report.linhas
        .filter((l) => l.key !== "ferragens" && l.key !== "paineis" && l.key !== "chapasReais")
        .every((l) => (l.detalhe?.length ?? 0) === 0)
    ).toBe(true);
  });
});
