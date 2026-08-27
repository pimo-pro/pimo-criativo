import { describe, expect, it, vi } from "vitest";
import { priceChapasSheetsEur } from "./priceChapasSheetsEur";

vi.mock("../pricing/pricing", () => ({
  getPrecoPorMaterial: (material: string) => {
    if (/carvalho/i.test(material)) return 60;
    if (/branco/i.test(material)) return 7.5;
    return 10;
  },
}));

describe("priceChapasSheetsEur", () => {
  it("soma por chapa × material (não N × preço dominante)", () => {
    const sheet = (material: string) => ({
      material,
      espessuraMm: 19,
      sheetLarguraMm: 2800,
      sheetAlturaMm: 2070,
    });
    const area = (2800 / 1000) * (2070 / 1000);
    const r = priceChapasSheetsEur([
      sheet("AGL LAM BRANCO 19"),
      sheet("AGL LAM BRANCO 19"),
      sheet("AGL CARVALHO 19"),
    ]);
    expect(r.sheetCount).toBe(3);
    expect(r.totalEur).toBe(
      Math.round((7.5 * area + 7.5 * area + 60 * area) * 100) / 100
    );
    const oldDominant = Math.round(3 * 7.5 * area * 100) / 100;
    expect(r.totalEur).toBeGreaterThan(oldDominant);
  });
});
