import { describe, expect, it } from "vitest";
import {
  aggregateChapasByEspessura,
  applyPrecoPorMetroEdit,
  areaM2FromMedida,
  precoChapaFromArea,
  precoM2FromChapa,
  precoPorMetroFromM2,
  recalcChapaDetalhe,
} from "./chapasReport";
import type { ChapasRealSheetRow } from "@/core/industrial/computeChapasReal";

function sheet(esp: number, material = "MDF"): ChapasRealSheetRow {
  return {
    sheetIndex: 1,
    espessuraMm: esp,
    material,
    sheetLarguraMm: 2800,
    sheetAlturaMm: 2070,
    pieceCount: 1,
    usedAreaMm2: 1,
    sheetAreaMm2: 2800 * 2070,
    wasteMm2: 0,
    wastePct: 0,
    pieces: [],
  };
}

describe("chapasReport", () => {
  it("nao repete chapas com a mesma espessura", () => {
    const rows = aggregateChapasByEspessura([
      sheet(19),
      sheet(19),
      sheet(10, "Costa"),
      sheet(19),
    ]);
    expect(rows).toHaveLength(2);
    const r19 = rows.find((r) => r.espessuraMm === 19);
    const r10 = rows.find((r) => r.espessuraMm === 10);
    expect(r19?.quantidade).toBe(3);
    expect(r10?.quantidade).toBe(1);
    expect(r19?.comprimentoMm).toBe(2800);
    expect(r19?.larguraMm).toBe(2070);
  });

  it("area real = L x A / 1e6 (legado)", () => {
    expect(areaM2FromMedida("2800 x 2070 mm")).toBeCloseTo(5.796, 2);
    expect(areaM2FromMedida("1400 x 2070 mm")).toBeCloseTo(2.898, 2);
  });

  it("preco m2 legado = preco_chapa / area_chapa", () => {
    expect(precoM2FromChapa(174, 5.8)).toBe(30);
  });

  it("preco por metro = €/m2 × largura_m", () => {
    expect(precoPorMetroFromM2(31, 2070)).toBeCloseTo(31 * 2.07, 1);
  });

  it("recalcula preco proporcional ao comprimento (1 m)", () => {
    const full = recalcChapaDetalhe({
      id: "1",
      tipo: "MDF",
      dimensoes: "2800 x 2070 mm",
      comprimentoMm: 2800,
      larguraMm: 2070,
      quantidade: 1,
      precoUnitario: 0,
      total: 0,
      espessuraMm: 19,
      precoPorMetro: 50,
    });
    expect(full.precoUnitario).toBeCloseTo(50 * 2.8, 1);

    const oneMeter = recalcChapaDetalhe({
      ...full,
      comprimentoMm: 1000,
      larguraMm: 2070,
    });
    expect(oneMeter.precoUnitario).toBeCloseTo(50, 1);
    expect(oneMeter.precoUnitario).toBeLessThan(full.precoUnitario);
  });

  it("editar preco por metro atualiza total", () => {
    const next = applyPrecoPorMetroEdit(
      {
        id: "1",
        tipo: "MDF",
        dimensoes: "1000 x 2070 mm",
        comprimentoMm: 1000,
        larguraMm: 2070,
        quantidade: 2,
        precoUnitario: 0,
        total: 0,
        espessuraMm: 19,
        precoPorMetro: 0,
      },
      40
    );
    expect(next.precoPorMetro).toBe(40);
    expect(next.precoUnitario).toBe(40);
    expect(next.total).toBe(80);
  });

  it("migra legado €/m2 para €/m", () => {
    const next = recalcChapaDetalhe({
      id: "1",
      tipo: "MDF",
      dimensoes: "2800 x 2070 mm",
      quantidade: 1,
      precoUnitario: 0,
      total: 0,
      espessuraMm: 19,
      precoPorM2: 31,
    });
    expect(next.precoPorMetro).toBeCloseTo(precoPorMetroFromM2(31, 2070), 1);
    expect(next.precoUnitario).toBeCloseTo(next.precoPorMetro! * 2.8, 1);
    expect(precoChapaFromArea(31, "2800 x 2070 mm")).toBeGreaterThan(0);
  });
});
