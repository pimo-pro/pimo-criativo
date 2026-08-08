import { describe, expect, it } from "vitest";
import {
  aggregateChapasByEspessura,
  applyPrecoChapaEdit,
  AREA_CHAPA_PADRAO_M2,
  areaM2FromMedida,
  precoChapaFromArea,
  precoM2FromChapa,
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
    expect(r19?.areaChapaM2).toBe(AREA_CHAPA_PADRAO_M2);
  });

  it("area real = L x A / 1e6", () => {
    expect(areaM2FromMedida("2800 x 2070 mm")).toBeCloseTo(5.796, 2);
    expect(areaM2FromMedida("1400 x 2070 mm")).toBeCloseTo(2.898, 2);
  });

  it("preco m2 = preco_chapa / area_chapa", () => {
    expect(precoM2FromChapa(174, 5.8)).toBe(30);
  });

  it("recalcula preco proporcional ao mudar medida", () => {
    const full = recalcChapaDetalhe({
      id: "1",
      tipo: "MDF",
      dimensoes: "2800 x 2070 mm",
      quantidade: 1,
      precoUnitario: 0,
      total: 0,
      espessuraMm: 19,
      areaChapaM2: 5.8,
      precoPorM2: 31,
    });
    expect(full.precoUnitario).toBeCloseTo(precoChapaFromArea(31, "2800 x 2070 mm"), 1);

    const half = recalcChapaDetalhe({
      ...full,
      dimensoes: "1400 x 2070 mm",
    });
    expect(half.precoUnitario).toBeCloseTo(31 * areaM2FromMedida("1400 x 2070 mm"), 1);
    expect(half.precoUnitario).toBeLessThan(full.precoUnitario);
  });

  it("editar preco da chapa atualiza preco m2", () => {
    const next = applyPrecoChapaEdit(
      {
        id: "1",
        tipo: "MDF",
        dimensoes: "2800 x 2070 mm",
        quantidade: 1,
        precoUnitario: 0,
        total: 0,
        areaChapaM2: 5.8,
        precoPorM2: 0,
      },
      174
    );
    expect(next.precoPorM2).toBe(30);
    expect(next.precoUnitario).toBeCloseTo(30 * areaM2FromMedida("2800 x 2070 mm"), 1);
  });
});
