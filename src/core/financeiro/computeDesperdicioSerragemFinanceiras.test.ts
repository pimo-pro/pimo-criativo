import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { CutListItemComPreco } from "../types";
import {
  computeDesperdicioSerragemFinanceiras,
  estimateSerragemM2,
} from "./computeDesperdicioSerragemFinanceiras";
import * as tcnLayoutKerf from "../cnc/tcnLayoutKerf";

function piece(
  partial: Partial<CutListItemComPreco> & { id: string; w?: number; h?: number; qty?: number }
): CutListItemComPreco {
  const w = partial.w ?? 600;
  const h = partial.h ?? 400;
  return {
    id: partial.id,
    nome: "p",
    tipo: "lateral_esquerda",
    material: "MDF",
    quantidade: partial.qty ?? 1,
    dimensoes: { largura: w, altura: h, profundidade: 18 },
    espessura: 18,
    precoUnitario: 0,
    precoTotal: 0,
    ...partial,
  };
}

describe("computeDesperdicioSerragemFinanceiras (P3.9 F3b)", () => {
  beforeEach(() => {
    vi.spyOn(tcnLayoutKerf, "getLayoutKerfMmForCncNesting").mockReturnValue(3);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("flags off → euros 0 + warnings", () => {
    const cutlist = [piece({ id: "a" }), piece({ id: "b", w: 300, h: 200 })];
    const r = computeDesperdicioSerragemFinanceiras({
      cutlist,
      wasteM2: 1.5,
      custoPaineisEur: 100,
      tarifas: {
        enableDesperdicio: false,
        enableSerragem: false,
        desperdicioPercentual: 0.18,
        serragemEurPorM2: 5,
      },
    });
    expect(r.precoDesperdicio).toBe(0);
    expect(r.precoSerragem).toBe(0);
    expect(r.precoTotal).toBe(0);
    expect(r.warnings.some((w) => w.includes("enableDesperdicio"))).toBe(true);
    expect(r.warnings.some((w) => w.includes("enableSerragem"))).toBe(true);
  });

  it("desperdício = percentual × custo painéis (não wasteM2 × €/m²)", () => {
    const cutlist = [
      piece({ id: "a", w: 1000, h: 1000, qty: 1 }),
      piece({ id: "b", w: 1000, h: 1000, qty: 1 }),
    ];
    const r = computeDesperdicioSerragemFinanceiras({
      cutlist,
      wasteM2: 99, // ignorado no €
      serragemM2: 1,
      custoPaineisEur: 136.13,
      tarifas: {
        enableDesperdicio: true,
        enableSerragem: true,
        desperdicioPercentual: 0.18,
        desperdicioEurPorM2: 31, // legado — não usar
        serragemEurPorM2: 4,
      },
    });
    expect(r.precoDesperdicio).toBe(24.5);
    expect(r.precoSerragem).toBe(4);
    expect(r.precoTotal).toBe(28.5);
  });

  it("custoPaineisEur=0 com flag on → desp 0 + warning", () => {
    const r = computeDesperdicioSerragemFinanceiras({
      cutlist: [piece({ id: "a" })],
      wasteM2: 2,
      custoPaineisEur: 0,
      tarifas: {
        enableDesperdicio: true,
        enableSerragem: false,
        desperdicioPercentual: 0.18,
        serragemEurPorM2: 0,
      },
    });
    expect(r.precoDesperdicio).toBe(0);
    expect(r.warnings.some((w) => w.includes("custoPaineisEur=0"))).toBe(true);
  });

  it("estimateSerragemM2 > 0 with kerf", () => {
    const m2 = estimateSerragemM2([piece({ id: "a", w: 1000, h: 500 })]);
    expect(m2).toBeGreaterThan(0);
  });
});
