import { describe, expect, it } from "vitest";
import { normalizeTallPieceToLandscape, shouldNormalizeTallPieceToLandscape } from "./tallPieceNormalization";

describe("tallPieceNormalization", () => {
  it("lateral alta: 80×200 → 200×80 com furo (10,30) → (30,70)", () => {
    const result = normalizeTallPieceToLandscape(
      80,
      200,
      [{ x: 10, y: 30, diameter: 5, depth: 12 }],
      "lateral"
    );
    expect(result.normalized).toBe(true);
    expect(result.larguraMm).toBe(200);
    expect(result.alturaMm).toBe(80);
    expect(result.holes?.[0]).toMatchObject({ x: 30, y: 70 });
  });

  it("prateleira alta: não normaliza (eixo largura×profundidade)", () => {
    expect(shouldNormalizeTallPieceToLandscape("prateleira", 400, 560)).toBe(false);
    const result = normalizeTallPieceToLandscape(
      400,
      560,
      [{ x: 20, y: 30, diameter: 5, depth: 12 }],
      "prateleira"
    );
    expect(result.normalized).toBe(false);
    expect(result.larguraMm).toBe(400);
    expect(result.alturaMm).toBe(560);
    expect(result.holes?.[0]).toMatchObject({ x: 20, y: 30 });
  });

  it("porta com veio bloqueado: não normaliza", () => {
    expect(
      shouldNormalizeTallPieceToLandscape("lateral_esquerda", 80, 200, { lockWoodGrain: true })
    ).toBe(false);
  });
});
