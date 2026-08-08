import { describe, expect, it } from "vitest";
import { recalcOrlaDetalhe } from "./orlaReport";

describe("orlaReport", () => {
  it("recalcula total = metros x preco por metro", () => {
    const next = recalcOrlaDetalhe({
      id: "1",
      tipo: "PVC 1mm",
      dimensoes: "m",
      quantidade: 12.5,
      precoUnitario: 0.8,
      total: 0,
    });
    expect(next.total).toBe(10);
    expect(next.dimensoes).toBe("m");
  });
});
