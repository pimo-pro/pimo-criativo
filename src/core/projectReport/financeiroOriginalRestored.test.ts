/**
 * P3.22 — Fluxo original: state → adapter → industrialRules → totals → UI.
 * Unificado = SSOT dos totais oficiais; não constrói o detalhe da UI.
 */
import { describe, expect, it } from "vitest";
import { FINANCEIRO_CUSTO_KEYS } from "@/core/financeiro/financeiroUnificadoTypes";
import { computeFinanceiroUnificado } from "@/core/financeiro/financeiroUnificado";
import { defaultRulesConfig } from "@/core/rules/rulesConfig";
import type { BoxModule } from "@/core/types";
import { buildFinanceiroPageFromState } from "./buildFinanceiroPage";
import { financeiroAdapter } from "./financeiroAdapter";
import { financeiroIndustrialRules } from "./financeiroIndustrialRules";
import { financeiroTotals } from "./financeiroTotals";
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

function sampleProject() {
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

  return {
    boxes: [box],
    rules: defaultRulesConfig,
    materialId: "mdf_branco",
    projectName: "P3.22",
    remates: [],
    rodapes: [],
  };
}

describe("P3.22 Financeiro lógica original", () => {
  it("expõe todos os blocos de custo com labels", () => {
    for (const key of BLOCOS) {
      expect(FINANCEIRO_CUSTO_KEYS).toContain(key);
      expect(FINANCEIRO_REPORT_LABELS[key].length).toBeGreaterThan(0);
    }
  });

  it("pipeline adapter → industrialRules → totals sem Unificado no detalhe", () => {
    const project = sampleProject();
    const model = financeiroAdapter(project as never, "p3-22-test");
    expect(model.projectId).toBe("p3-22-test");
    expect(model.ivaPct).toBeGreaterThanOrEqual(0);

    const ruled = financeiroIndustrialRules({ model, materiais: [], ferragensCatalog: [] });
    for (const key of BLOCOS) {
      expect(ruled.linhas.some((l) => l.key === key)).toBe(true);
    }
    const portas = ruled.linhas.find((l) => l.key === "portas");
    const remates = ruled.linhas.find((l) => l.key === "remates");
    expect(portas?.total).toBe(0);
    expect(remates?.total).toBe(0);

    const totaled = financeiroTotals(ruled);
    expect(totaled.linhas.some((l) => l.key === "iva")).toBe(true);
    expect(totaled.linhas.some((l) => l.key === "total")).toBe(true);
  });

  it("buildFinanceiroPage alinha totais oficiais ao Unificado", () => {
    const project = sampleProject();
    const snap = computeFinanceiroUnificado(project);
    const page = buildFinanceiroPageFromState(project as never, "p3-22-test");
    expect(page.ivaPct).toBe(snap.ivaPct);
    expect(page.subtotal).toBe(Math.round(snap.subtotal * 100) / 100);
    expect(page.ivaValor).toBe(Math.round(snap.ivaValor * 100) / 100);
    expect(page.totalProjeto).toBe(Math.round(snap.totalProjeto * 100) / 100);

    const display = financeiroCustoLinhasDisplay(page.linhas);
    for (const key of BLOCOS) {
      expect(display.some((l) => l.key === key)).toBe(true);
    }
    expect(display.some((l) => l.key === "chapasReais")).toBe(false);
  });
});
