import { describe, expect, it } from "vitest";
import {
  aggregateChapasByEspessura,
  precoChapaFromArea,
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
  });

  it("recalcula preco ao mudar medida com precoPorM2", () => {
    const area = 2.8 * 2.07;
    const unit = precoChapaFromArea(31, "2800 x 2070 mm");
    expect(unit).toBeCloseTo(31 * area, 1);

    const next = recalcChapaDetalhe({
      id: "1",
      tipo: "MDF",
      dimensoes: "1400 x 2070 mm",
      quantidade: 2,
      precoUnitario: 0,
      total: 0,
      espessuraMm: 19,
      precoPorM2: 31,
    });
    expect(next.precoUnitario).toBeCloseTo(31 * 1.4 * 2.07, 1);
    expect(next.total).toBeCloseTo(next.precoUnitario * 2, 1);
  });
});
