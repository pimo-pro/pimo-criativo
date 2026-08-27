import { describe, expect, it } from "vitest";
import {
  aggregateChapasByEspessura,
  aggregateChapasByEspessuraEMaterial,
  applyPrecoPorMetroEdit,
  areaM2FromMedida,
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

  it("aggregateChapasByEspessuraEMaterial: dois materiais @18mm → duas linhas", () => {
    const rows = aggregateChapasByEspessuraEMaterial([
      sheet(18, "Carvalho"),
      sheet(18, "MDF Branco"),
      sheet(18, "Carvalho"),
    ]);
    expect(rows).toHaveLength(2);
    const carvalho = rows.find((r) => r.tipo === "Carvalho");
    const mdf = rows.find((r) => r.tipo === "MDF Branco");
    expect(carvalho?.quantidade).toBe(2);
    expect(mdf?.quantidade).toBe(1);
    expect(carvalho?.id).toBe("ch-18-carvalho");
    expect(mdf?.id).toBe("ch-18-mdf-branco");
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

  it("preço dinâmico: alterar largura actualiza €/m a partir de €/m²", () => {
    const base = recalcChapaDetalhe({
      id: "1",
      tipo: "MDF",
      dimensoes: "2800 x 2070 mm",
      comprimentoMm: 2800,
      larguraMm: 2070,
      quantidade: 1,
      precoUnitario: 0,
      total: 0,
      espessuraMm: 19,
      precoPorM2: 31,
    });
    const metroFull = base.precoPorMetro!;
    expect(metroFull).toBeCloseTo(precoPorMetroFromM2(31, 2070), 1);

    const halfWidth = recalcChapaDetalhe({
      ...base,
      larguraMm: 1035,
    });
    expect(halfWidth.precoPorMetro).toBeCloseTo(precoPorMetroFromM2(31, 1035), 1);
    expect(halfWidth.precoPorMetro).toBeLessThan(metroFull);
    expect(halfWidth.precoUnitario).toBeCloseTo(31 * areaM2FromMedida("2800 x 1035 mm"), 1);
  });

  it("preço parcial = €/m² × área parcial ao alterar comprimento", () => {
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
      precoPorM2: 31,
    });
    const half = recalcChapaDetalhe({
      ...full,
      comprimentoMm: 1400,
    });
    expect(half.precoUnitario).toBeCloseTo(full.precoUnitario! / 2, 1);
    expect(half.precoPorMetro).toBeCloseTo(full.precoPorMetro!, 1);
  });
});
