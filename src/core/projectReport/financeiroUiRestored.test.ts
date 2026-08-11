/**
 * P3.25 — Asserts SSOT no Relatório (substitui asserts de UI com detalhe editável).
 */
import { describe, expect, it } from "vitest";
import { FINANCEIRO_CUSTO_KEYS } from "@/core/financeiro/financeiroUnificadoTypes";
import { computeFinanceiroUnificado } from "@/core/financeiro/financeiroUnificado";
import { defaultRulesConfig } from "@/core/rules/rulesConfig";
import type { BoxModule } from "@/core/types";
import { FINANCEIRO_REPORT_LABELS } from "./types";
import { buildLiveReportFinanceiro } from "./financeiroFromUnificado";
import { financeiroCustoLinhasDisplay } from "./financeiroDisplay";

const BLOCOS_ESPERADOS = [
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

describe("P3.25 Financeiro Relatório SSOT", () => {
  it("expõe todos os blocos sem chapasReais duplicado e sem detalhe", () => {
    for (const key of BLOCOS_ESPERADOS) {
      expect(FINANCEIRO_CUSTO_KEYS).toContain(key);
      expect(FINANCEIRO_REPORT_LABELS[key]).toBeTruthy();
    }
    const fin = buildLiveReportFinanceiro(null, []);
    const display = financeiroCustoLinhasDisplay(fin.linhas);
    for (const key of BLOCOS_ESPERADOS) {
      expect(display.some((l) => l.key === key)).toBe(true);
    }
    expect(display.some((l) => l.key === "chapasReais")).toBe(false);
    expect(fin.linhas.every((l) => (l.detalhe?.length ?? 0) === 0)).toBe(true);
  });

  it("Total do relatório = Total do ADMIN", () => {
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
      projectName: "P3.25-ui",
      remates: [],
      rodapes: [],
    };
    const snap = computeFinanceiroUnificado(project);
    const report = buildLiveReportFinanceiro(project as never, []);
    expect(report.totalProjeto).toBe(Math.round(snap.totalProjeto * 100) / 100);
    expect(report.ivaValor).toBe(Math.round(snap.ivaValor * 100) / 100);
    expect(report.subtotal).toBe(Math.round(snap.subtotal * 100) / 100);
  });
});
