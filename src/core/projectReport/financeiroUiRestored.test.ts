/**
 * P3.22 — UI Financeiro: todos os blocos visíveis; totais alinhados ao Unificado.
 */
import { describe, expect, it } from "vitest";
import { FINANCEIRO_CUSTO_KEYS } from "@/core/financeiro/financeiroUnificadoTypes";
import { computeFinanceiroUnificado } from "@/core/financeiro/financeiroUnificado";
import { defaultRulesConfig } from "@/core/rules/rulesConfig";
import type { BoxModule } from "@/core/types";
import { FINANCEIRO_REPORT_LABELS } from "./types";
import { buildFinanceiroPageFromState } from "./buildFinanceiroPage";
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

describe("P3.22 Financeiro UI original", () => {
  it("expõe todos os blocos de custo (sem chapasReais duplicado)", () => {
    for (const key of BLOCOS_ESPERADOS) {
      expect(FINANCEIRO_CUSTO_KEYS).toContain(key);
      expect(FINANCEIRO_REPORT_LABELS[key]).toBeTruthy();
    }
    const fin = buildFinanceiroPageFromState(null, "empty");
    const display = financeiroCustoLinhasDisplay(fin.linhas);
    for (const key of BLOCOS_ESPERADOS) {
      expect(display.some((l) => l.key === key)).toBe(true);
    }
    expect(display.some((l) => l.key === "chapasReais")).toBe(false);
    expect(display.some((l) => l.key === "iva")).toBe(false);
    expect(display.some((l) => l.key === "total")).toBe(false);
  });

  it("Total da página permanece alinhado ao Unificado", () => {
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
      projectName: "P3.22-ui",
      remates: [],
      rodapes: [],
    };
    const snap = computeFinanceiroUnificado(project);
    const report = buildFinanceiroPageFromState(project as never, "p3-22-ui");
    expect(report.totalProjeto).toBe(Math.round(snap.totalProjeto * 100) / 100);
    expect(report.ivaValor).toBe(Math.round(snap.ivaValor * 100) / 100);
    expect(report.linhas.some((l) => l.key === "iva")).toBe(true);
    expect(report.linhas.some((l) => l.key === "total")).toBe(true);
  });
});
