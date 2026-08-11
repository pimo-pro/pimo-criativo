/**
 * P3.21 — Fluxo Financeiro do Relatório restaurado (pré-P3.17 UI/seed).
 * Nota: financeiroAdapter / financeiroIndustrialRules / financeiroTotals
 * nunca existiram no repo — SSOT continua computeFinanceiroUnificado.
 */
import { describe, expect, it } from "vitest";
import { FINANCEIRO_CUSTO_KEYS } from "@/core/financeiro/financeiroUnificadoTypes";
import { computeFinanceiroUnificado } from "@/core/financeiro/financeiroUnificado";
import { defaultRulesConfig } from "@/core/rules/rulesConfig";
import type { BoxModule } from "@/core/types";
import { ensureFinanceiroShape } from "./financeReportCalc";
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

describe("P3.21 Financeiro original (Relatório)", () => {
  it("todos os blocos de custo existem com labels", () => {
    for (const key of BLOCOS) {
      expect(FINANCEIRO_CUSTO_KEYS).toContain(key);
      expect(FINANCEIRO_REPORT_LABELS[key].length).toBeGreaterThan(0);
    }
  });

  it("seed a partir do Unificado preserva totais oficiais (antes de detalhe de chapas)", () => {
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
      projectName: "P3.21",
      remates: [],
      rodapes: [],
    };
    const snap = computeFinanceiroUnificado(project);
    const seed: Partial<Record<(typeof FINANCEIRO_CUSTO_KEYS)[number], number>> = {};
    for (const key of FINANCEIRO_CUSTO_KEYS) {
      seed[key] = snap.custosEffective[key] ?? 0;
    }
    const fin = ensureFinanceiroShape({ ivaPct: snap.ivaPct }, seed);
    expect(fin.ivaPct).toBe(snap.ivaPct);
    expect(fin.subtotal).toBe(Math.round(snap.subtotal * 100) / 100);
    expect(fin.ivaValor).toBe(Math.round(snap.ivaValor * 100) / 100);
    expect(fin.totalProjeto).toBe(Math.round(snap.totalProjeto * 100) / 100);
    expect(fin.linhas.some((l) => l.key === "iva")).toBe(true);
    expect(fin.linhas.some((l) => l.key === "total")).toBe(true);
    for (const key of BLOCOS) {
      expect(fin.linhas.some((l) => l.key === key)).toBe(true);
    }
  });
});
