import { describe, expect, it } from "vitest";
import { financeiroCustoRows, financeiroMetricRows } from "./financeiroUnificado";
import type { FinanceiroUnificadoSnapshot } from "./financeiroUnificadoTypes";

function baseSnap(
  partial: Partial<FinanceiroUnificadoSnapshot> & {
    custosEffective: FinanceiroUnificadoSnapshot["custosEffective"];
  }
): FinanceiroUnificadoSnapshot {
  return {
    caixas: 1,
    pecasTotais: 4,
    areaTotalM2: 2,
    pesoTotalKg: 10,
    areaTotalMontadoM3: 0.5,
    chapas: { count: 2, mode: "real" },
    desperdicioTotalM2: 0,
    serragemTotalM2: 0,
    ferragensTotais: 0,
    orlaTotalM: 0,
    custosComputed: partial.custosEffective,
    custoKeysOverridden: [],
    ivaPct: 23,
    distanciaKm: 0,
    subtotal: 0,
    subtotalComAdmin: 0,
    ivaValor: 0,
    totalProjeto: 0,
    overrides: {},
    adminSettings: {} as FinanceiroUnificadoSnapshot["adminSettings"],
    ...partial,
  };
}

const zeroCustos = {
  paineis: 0,
  portas: 0,
  gavetas: 0,
  ferragens: 0,
  orla: 0,
  remates: 0,
  operacoes: 0,
  desperdicio: 0,
  serragem: 0,
  chapasReais: 0,
  maoDeObra: 0,
  logistica: 0,
  operacoesAvancadas: 0,
  adm: 0,
  montagem: 0,
  portes: 0,
} as FinanceiroUnificadoSnapshot["custosEffective"];

describe("Labels Financeiro UI — Painéis / Gavetas (sem Chapas reais)", () => {
  it("não expõe linha «Chapas reais» nos custos UI", () => {
    const snap = baseSnap({
      materialCostMode: "por_chapas_reais",
      chapasReaisMeta: {
        countMonetizado: 3,
        custoChapaDerived: 42.5,
        nestingMode: "real",
      },
      custosEffective: { ...zeroCustos, chapasReais: 127.5, paineis: 0 },
      totalProjeto: 127.5,
    });
    const labels = financeiroCustoRows(snap).map((r) => r.label);
    expect(labels.some((l) => l.startsWith("Chapas reais"))).toBe(false);
    expect(labels).toContain("Painéis");
    expect(labels).toContain("Gavetas");
    expect(labels).not.toContain("Gavetas (montagem N × 15 €)");
  });

  it("por_peca → Painéis genérico, sem Chapas reais", () => {
    const snap = baseSnap({
      materialCostMode: "por_peca",
      chapasReaisMeta: {
        countMonetizado: 0,
        custoChapaDerived: 40,
        nestingMode: "estimado",
      },
      custosEffective: { ...zeroCustos, paineis: 200, chapasReais: 0 },
    });
    const labels = financeiroCustoRows(snap).map((r) => r.label);
    expect(labels).toContain("Painéis");
    expect(labels.some((l) => l.startsWith("Chapas reais"))).toBe(false);
    expect(labels).not.toContain("Painéis (substituídos por chapas)");
  });

  it("métricas incluem Modo material em por_chapas_reais", () => {
    const snap = baseSnap({
      materialCostMode: "por_chapas_reais",
      custosEffective: zeroCustos,
    });
    const rows = financeiroMetricRows(snap);
    expect(rows.some(([k, v]) => k === "Modo material" && v.includes("chapas reais"))).toBe(
      true
    );
  });

  it("labels de métrica chapas: estimado / oficial_pro / real", () => {
    expect(
      financeiroMetricRows(
        baseSnap({ chapas: { count: 3, mode: "estimado" }, custosEffective: zeroCustos })
      ).find(([k]) => k.startsWith("Nº de chapas"))?.[0]
    ).toBe("Nº de chapas (Estimado)");

    expect(
      financeiroMetricRows(
        baseSnap({ chapas: { count: 5, mode: "oficial_pro" }, custosEffective: zeroCustos })
      ).find(([k]) => k.startsWith("Nº de chapas"))?.[0]
    ).toBe("Nº de chapas (Oficial TCN/PRO)");

    expect(
      financeiroMetricRows(
        baseSnap({ chapas: { count: 2, mode: "real" }, custosEffective: zeroCustos })
      ).find(([k]) => k.startsWith("Nº de chapas"))?.[0]
    ).toBe("Nº de chapas (Real)");
  });

  it("acentos PT nas linhas de custo", () => {
    const snap = baseSnap({ custosEffective: zeroCustos });
    const labels = financeiroCustoRows(snap).map((r) => r.label);
    expect(labels).toContain("Operações (CNC/Drill)");
    expect(labels).toContain("Desperdício");
    expect(labels).toContain("Mão de obra");
    expect(labels).toContain("Logística");
  });
});
