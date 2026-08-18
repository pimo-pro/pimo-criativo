/**
 * P3.25 — Fluxo Relatório = Unificado live (sem adapter/detalhe que altere preços).
 */
import { describe, expect, it } from "vitest";
import { FINANCEIRO_CUSTO_KEYS } from "@/core/financeiro/financeiroUnificadoTypes";
import { computeFinanceiroUnificado } from "@/core/financeiro/financeiroUnificado";
import { defaultRulesConfig } from "@/core/rules/rulesConfig";
import type { BoxModule } from "@/core/types";
import { buildLiveReportFinanceiro } from "./financeiroFromUnificado";
import { financeiroCustoLinhasDisplay } from "./financeiroDisplay";
import { FINANCEIRO_REPORT_LABELS } from "./types";

const BLOCOS = [
  "paineis",
  "portas",
  "gavetas",
  "ferragens",
  "orla",
  "remates",
  "operacoes",
  "desperdicio",
  "serragem",
  "maoDeObra",
  "logistica",
  "operacoesAvancadas",
  "adm",
  "montagem",
  "portes",
] as const;

describe("P3.25 Financeiro original SSOT", () => {
  it("expõe todos os blocos de custo com labels", () => {
    for (const key of BLOCOS) {
      expect(FINANCEIRO_CUSTO_KEYS).toContain(key);
      expect(FINANCEIRO_REPORT_LABELS[key].length).toBeGreaterThan(0);
    }
  });

  it("buildLive alinha totais oficiais ao Unificado sem detalhe", () => {
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
      projectName: "P3.25-orig",
      remates: [],
      rodapes: [],
    };
    const snap = computeFinanceiroUnificado(project);
    const page = buildLiveReportFinanceiro(project as never, []);
    expect(page.ivaPct).toBe(snap.ivaPct);
    expect(page.subtotal).toBe(Math.round(snap.subtotal * 100) / 100);
    expect(page.ivaValor).toBe(Math.round(snap.ivaValor * 100) / 100);
    expect(page.totalProjeto).toBe(Math.round(snap.totalProjeto * 100) / 100);

    const display = financeiroCustoLinhasDisplay(page.linhas);
    for (const key of BLOCOS) {
      expect(display.some((l) => l.key === key)).toBe(true);
    }
    expect(display.some((l) => l.key === "chapasReais")).toBe(false);
    expect(
      page.linhas
        .filter((l) => l.key !== "ferragens" && l.key !== "paineis" && l.key !== "chapasReais")
        .every((l) => (l.detalhe?.length ?? 0) === 0)
    ).toBe(true);
    expect(page.linhas.find((l) => l.key === "ferragens")?.total).toBe(
      Math.round((snap.custosEffective.ferragens || 0) * 100) / 100
    );
  });
});
