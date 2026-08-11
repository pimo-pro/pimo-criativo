/**
 * P3.23 — Sanitização e alinhamento da UI Financeiro.
 */
import { describe, expect, it } from "vitest";
import { FINANCEIRO_CUSTO_KEYS } from "@/core/financeiro/financeiroUnificadoTypes";
import { computeFinanceiroUnificado } from "@/core/financeiro/financeiroUnificado";
import { defaultRulesConfig } from "@/core/rules/rulesConfig";
import type { BoxModule } from "@/core/types";
import { buildFinanceiroPageFromState } from "./buildFinanceiroPage";
import {
  isInvalidFinanceiroDetalheTipo,
  isPecaCaixaTipo,
  isPregoParaCostaTipo,
  sanitizeFinanceiroDetalhe,
} from "./financeiroDetalheSanitize";
import { financeiroCustoLinhasDisplay } from "./financeiroDisplay";
import { FINANCEIRO_REPORT_LABELS } from "./types";

describe("P3.23 Financeiro UI correcções", () => {
  it("labels sem caracteres corrompidos e com nomes correctos", () => {
    expect(FINANCEIRO_REPORT_LABELS.paineis).toBe("Painéis");
    expect(FINANCEIRO_REPORT_LABELS.portas).toBe("Portas");
    expect(FINANCEIRO_REPORT_LABELS.gavetas).toBe("Gavetas");
    for (const key of Object.keys(FINANCEIRO_REPORT_LABELS) as (keyof typeof FINANCEIRO_REPORT_LABELS)[]) {
      const label = FINANCEIRO_REPORT_LABELS[key];
      expect(label).not.toMatch(/Ã|Â|â|�/);
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("remove Prego para Costa e nomes de peças do caixa", () => {
    expect(isPregoParaCostaTipo("Prego para Costa")).toBe(true);
    expect(isPregoParaCostaTipo("prego_costa")).toBe(true);
    expect(isPecaCaixaTipo("CIMA")).toBe(true);
    expect(isPecaCaixaTipo("LADO")).toBe(true);
    expect(isPecaCaixaTipo("FRENTE")).toBe(true);
    expect(isPecaCaixaTipo("COSTA")).toBe(true);
    expect(isPecaCaixaTipo("CIMA (catálogo)")).toBe(true);
    expect(isInvalidFinanceiroDetalheTipo("Dobradiça")).toBe(false);

    const cleaned = sanitizeFinanceiroDetalhe([
      { id: "1", tipo: "Prego para Costa", dimensoes: "", quantidade: 12, precoUnitario: 0.02, total: 0.24 },
      { id: "2", tipo: "CIMA", dimensoes: "", quantidade: 1, precoUnitario: 0, total: 0 },
      { id: "3", tipo: "Dobradiça", dimensoes: "35mm", quantidade: 4, precoUnitario: 1.8, total: 7.2 },
    ]);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].tipo).toBe("Dobradiça");
  });

  it("categorias únicas sem chapasReais duplicado", () => {
    const page = buildFinanceiroPageFromState(null, "p3-23");
    const display = financeiroCustoLinhasDisplay(page.linhas);
    const keys = display.map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain("chapasReais");
    for (const key of FINANCEIRO_CUSTO_KEYS) {
      if (key === "chapasReais") continue;
      expect(keys).toContain(key);
    }
  });

  it("totais alinhados ao ADMIN (Unificado)", () => {
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
      projectName: "P3.23",
      remates: [],
      rodapes: [],
    };
    const snap = computeFinanceiroUnificado(project);
    const page = buildFinanceiroPageFromState(project as never, "p3-23");
    const paineisAdmin =
      Math.round(
        ((Number(snap.custosEffective.paineis) || 0) +
          (Number(snap.custosEffective.chapasReais) || 0)) *
          100
      ) / 100;
    expect(page.linhas.find((l) => l.key === "paineis")?.total).toBe(paineisAdmin);
    expect(page.linhas.find((l) => l.key === "portas")?.total).toBe(
      Math.round((snap.custosEffective.portas || 0) * 100) / 100
    );
    expect(page.linhas.find((l) => l.key === "ferragens")?.total).toBe(
      Math.round((snap.custosEffective.ferragens || 0) * 100) / 100
    );
    expect(page.linhas.find((l) => l.key === "orla")?.total).toBe(
      Math.round((snap.custosEffective.orla || 0) * 100) / 100
    );
    expect(page.linhas.find((l) => l.key === "portes")?.total).toBe(
      Math.round((snap.custosEffective.portes || 0) * 100) / 100
    );
    expect(page.totalProjeto).toBe(Math.round(snap.totalProjeto * 100) / 100);
    expect(page.ivaValor).toBe(Math.round(snap.ivaValor * 100) / 100);
  });
});
