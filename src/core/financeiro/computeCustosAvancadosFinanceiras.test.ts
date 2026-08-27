import { describe, expect, it } from "vitest";
import type { CutListItemComPreco } from "../types";
import {
  assertNoMaterialDoubleCount,
  computeCustosAvancadosFinanceiras,
} from "./computeCustosAvancadosFinanceiras";

function piece(
  partial: Partial<CutListItemComPreco> & {
    id: string;
    w?: number;
    h?: number;
    qty?: number;
    holes?: number;
  }
): CutListItemComPreco {
  const w = partial.w ?? 600;
  const h = partial.h ?? 400;
  const holes = partial.holes ?? 0;
  return {
    id: partial.id,
    nome: "p",
    tipo: "lateral_esquerda",
    material: "MDF",
    quantidade: partial.qty ?? 1,
    dimensoes: { largura: w, altura: h, profundidade: 18 },
    espessura: 18,
    precoUnitario: 0,
    precoTotal: 10,
    drillHoles:
      holes > 0
        ? Array.from({ length: holes }, (_, i) => ({
            id: `h${i}`,
            x: i,
            y: 0,
            diametro: 5,
            profundidade: 10,
          }))
        : undefined,
    ...partial,
  };
}

function sumMap(m: Map<string, number>): number {
  return Math.round([...m.values()].reduce((s, v) => s + v, 0) * 100) / 100;
}

describe("computeCustosAvancadosFinanceiras (P3.9 F3c)", () => {
  it("defaults / flags off → euros 0 (baseline)", () => {
    const cutlist = [piece({ id: "a" }), piece({ id: "b", w: 300, h: 200 })];
    const r = computeCustosAvancadosFinanceiras({
      cutlist,
      chapasCount: 3,
      chapasModeReal: true,
      pesoTotalKg: 40,
      custoChapaRealDerived: 50,
      tarifas: {
        materialCostMode: "por_peca",
        valorHoraMaquina: 35,
        custoLogisticaPorKg: 1,
        enableMaoDeObra: false,
        enableLogistica: false,
      },
    });
    expect(r.suppressPieceMaterial).toBe(false);
    expect(r.precoChapasReais).toBe(0);
    expect(r.precoMaoDeObra).toBe(0);
    expect(r.precoLogistica).toBe(0);
    expect(r.warnings.some((w) => w.includes("enableMaoDeObra"))).toBe(false);
  });

  it("por_chapas_reais → chapasReais = count × derivado + suppress material", () => {
    const cutlist = [
      piece({ id: "a", w: 1000, h: 1000 }),
      piece({ id: "b", w: 1000, h: 1000 }),
    ];
    const r = computeCustosAvancadosFinanceiras({
      cutlist,
      chapasCount: 4,
      chapasModeReal: true,
      pesoTotalKg: 10,
      custoChapaRealDerived: 25,
      tarifas: {
        materialCostMode: "por_chapas_reais",
        enableMaoDeObra: false,
        enableLogistica: false,
      },
    });
    expect(r.suppressPieceMaterial).toBe(true);
    expect(r.precoChapasReais).toBe(100);
    expect(sumMap(r.chapasByPieceId)).toBe(100);
    assertNoMaterialDoubleCount({
      pieceMaterialSum: 0,
      chapasReais: r.precoChapasReais,
    });
  });

  it("por_chapas_reais → precoChapasSheetsEur tem prioridade sobre N × derivado", () => {
    const cutlist = [
      piece({ id: "a", w: 1000, h: 1000 }),
      piece({ id: "b", w: 1000, h: 1000 }),
    ];
    const r = computeCustosAvancadosFinanceiras({
      cutlist,
      chapasCount: 4,
      chapasModeReal: true,
      pesoTotalKg: 10,
      custoChapaRealDerived: 25,
      precoChapasSheetsEur: 2385.42,
      tarifas: {
        materialCostMode: "por_chapas_reais",
        enableMaoDeObra: false,
        enableLogistica: false,
      },
    });
    expect(r.suppressPieceMaterial).toBe(true);
    expect(r.precoChapasReais).toBe(2385.42);
    expect(r.precoChapasReais).not.toBe(100);
    expect(sumMap(r.chapasByPieceId)).toBe(2385.42);
  });

  it("por_chapas_reais sem derivado → chapasReais 0 + fallback (sem suppress)", () => {
    const r = computeCustosAvancadosFinanceiras({
      cutlist: [piece({ id: "a" })],
      chapasCount: 3,
      chapasModeReal: true,
      pesoTotalKg: 1,
      tarifas: {
        materialCostMode: "por_chapas_reais",
        enableMaoDeObra: false,
        enableLogistica: false,
      },
    });
    expect(r.precoChapasReais).toBe(0);
    expect(r.suppressPieceMaterial).toBe(false);
    expect(r.warnings.some((w) => w.includes("derivado=0"))).toBe(true);
  });

  it("anti-double-count assert falha se ambos > 0", () => {
    expect(() =>
      assertNoMaterialDoubleCount({ pieceMaterialSum: 10, chapasReais: 5 })
    ).toThrow(/anti-double-count/);
  });

  it("mão de obra = EUR manual (não minutos × €/h)", () => {
    const cutlist = [
      piece({ id: "a", w: 1000, h: 1000, holes: 50 }),
      piece({ id: "b", w: 1000, h: 1000, holes: 0 }),
    ];
    const r = computeCustosAvancadosFinanceiras({
      cutlist,
      chapasCount: 0,
      chapasModeReal: false,
      pesoTotalKg: 0,
      tarifas: {
        materialCostMode: "por_peca",
        enableMaoDeObra: true,
        valorHoraMaquina: 80, // EUR manuais (campo legado)
        enableLogistica: false,
      },
    });
    expect(r.minutosEstimados).toBe(0);
    expect(r.precoMaoDeObra).toBe(80);
    expect(sumMap(r.maoDeObraByPieceId)).toBe(80);
    expect(r.maoDeObraByPieceId.get("a")).toBe(40);
    expect(r.maoDeObraByPieceId.get("b")).toBe(40);
    expect(r.valorHoraFromSystemFallback).toBe(false);
  });

  it("sem valor manual → mão de obra 0 (ignora peças/furos)", () => {
    const r = computeCustosAvancadosFinanceiras({
      cutlist: [piece({ id: "a", holes: 100 })],
      chapasCount: 0,
      chapasModeReal: false,
      pesoTotalKg: 0,
      tarifas: {
        materialCostMode: "por_peca",
        enableMaoDeObra: true,
        valorHoraMaquina: 0,
        enableLogistica: false,
      },
    });
    expect(r.precoMaoDeObra).toBe(0);
    expect(r.maoDeObraByPieceId.size).toBe(0);
    expect(r.minutosEstimados).toBe(0);
  });

  it("logística = EUR manual (não peso × €/kg)", () => {
    const cutlist = [
      piece({ id: "a", w: 1000, h: 1000 }),
      piece({ id: "b", w: 1000, h: 1000 }),
    ];
    const pesoByPieceId = new Map([
      ["a", 10],
      ["b", 30],
    ]);
    const r = computeCustosAvancadosFinanceiras({
      cutlist,
      chapasCount: 0,
      chapasModeReal: false,
      pesoTotalKg: 40,
      pesoByPieceId,
      tarifas: {
        materialCostMode: "por_peca",
        enableMaoDeObra: false,
        enableLogistica: true,
        custoLogisticaPorKg: 50, // EUR manuais (campo legado)
      },
    });
    expect(r.precoLogistica).toBe(50);
    expect(sumMap(r.logisticaByPieceId)).toBe(50);
    expect(r.logisticaByPieceId.get("a")).toBe(12.5);
    expect(r.logisticaByPieceId.get("b")).toBe(37.5);
  });

  it("sem valor manual → logística 0 (ignora peso)", () => {
    const r = computeCustosAvancadosFinanceiras({
      cutlist: [piece({ id: "a" })],
      chapasCount: 0,
      chapasModeReal: false,
      pesoTotalKg: 999,
      tarifas: {
        materialCostMode: "por_peca",
        enableMaoDeObra: false,
        enableLogistica: true,
        custoLogisticaPorKg: 0,
      },
    });
    expect(r.precoLogistica).toBe(0);
    expect(r.logisticaByPieceId.size).toBe(0);
  });

  it("por_chapas_reais sem sheets reais → chapasReais 0 + fallback (sem suppress)", () => {
    const r = computeCustosAvancadosFinanceiras({
      cutlist: [piece({ id: "a" })],
      chapasCount: 0,
      chapasModeReal: false,
      pesoTotalKg: 1,
      custoChapaRealDerived: 40,
      tarifas: {
        materialCostMode: "por_chapas_reais",
        enableMaoDeObra: false,
        enableLogistica: false,
      },
    });
    expect(r.precoChapasReais).toBe(0);
    expect(r.suppressPieceMaterial).toBe(false);
    expect(r.warnings.some((w) => w.includes("sem chapas reais"))).toBe(true);
  });
});
