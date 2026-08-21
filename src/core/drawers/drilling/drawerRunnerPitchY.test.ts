/**
 * Diff 1 — alturas Y das corrediças (modo pitch_H_sobre_n).
 * Referência industrial: gavita 8 / drill certo.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CORREDICA_DESCONTO_PAINEL_MM,
  DEFAULT_CORREDICA_EIXO_GAVETA1_MM,
  resolveEuropeanModuleRunnerLinesYMm,
  resolvePitchRunnerLinesFromBottomMm,
} from "./DrawerDrillingRules";

describe("resolvePitchRunnerLinesFromBottomMm", () => {
  it("H=800 n=3 T=19 → gavita 8 (41 / 288.667 / 555.333)", () => {
    const y = resolvePitchRunnerLinesFromBottomMm({
      boxExternalHeightMm: 800,
      drawerCount: 3,
      eixoGaveta1Mm: 41,
      descontoPainelMm: 19,
    });
    expect(y).toHaveLength(3);
    expect(y[0]).toBeCloseTo(41, 5);
    expect(y[1]).toBeCloseTo(288.6666666667, 5);
    expect(y[2]).toBeCloseTo(555.3333333333, 5);
  });

  it("H=800 n=4 T=19 → [41, 222, 422, 622]", () => {
    const y = resolvePitchRunnerLinesFromBottomMm({
      boxExternalHeightMm: 800,
      drawerCount: 4,
      descontoPainelMm: 19,
    });
    expect(y[0]).toBe(41);
    expect(y[1]).toBeCloseTo(222, 5);
    expect(y[2]).toBeCloseTo(422, 5);
    expect(y[3]).toBeCloseTo(622, 5);
  });

  it("H=700 n=3 T=19 → [41, 255.333, 488.667]", () => {
    const y = resolvePitchRunnerLinesFromBottomMm({
      boxExternalHeightMm: 700,
      drawerCount: 3,
      descontoPainelMm: 19,
    });
    expect(y[0]).toBeCloseTo(41, 5);
    expect(y[1]).toBeCloseTo(255.3333333333, 5);
    expect(y[2]).toBeCloseTo(488.6666666667, 5);
  });

  it("defaults industriais = 41 / T=19", () => {
    expect(DEFAULT_CORREDICA_EIXO_GAVETA1_MM).toBe(41);
    expect(DEFAULT_CORREDICA_DESCONTO_PAINEL_MM).toBe(19);
    const y = resolvePitchRunnerLinesFromBottomMm({
      boxExternalHeightMm: 800,
      drawerCount: 3,
    });
    expect(y[0]).toBe(41);
    expect(y[1]).toBeCloseTo(288.6666666667, 5);
  });
});

describe("resolveEuropeanModuleRunnerLinesYMm — pitch_H_sobre_n", () => {
  const drawers3 = [
    { posYMm: -200, frontHeightMm: 260 },
    { posYMm: 0, frontHeightMm: 260 },
    { posYMm: 200, frontHeightMm: 260 },
  ];

  it("gavita 8: panelH=762 → fromBottom 41 / 288.667 / 555.333", () => {
    const panelH = 762;
    const fromTop = resolveEuropeanModuleRunnerLinesYMm({
      panelHeightMm: panelH,
      boxInternalHeightMm: 800,
      boxExternalHeightMm: 800,
      floorThicknessMm: 19,
      drawers: drawers3,
    });
    const fromBottom = fromTop.map((y) => panelH - y);
    expect(fromBottom[0]).toBeCloseTo(41, 5);
    expect(fromBottom[1]).toBeCloseTo(288.6666666667, 5);
    expect(fromBottom[2]).toBeCloseTo(555.3333333333, 5);
    // Independente de posY das frentes (desacoplado do stack).
    expect(fromBottom[0]).toBe(DEFAULT_CORREDICA_EIXO_GAVETA1_MM);
  });

  it("H=800 n=4 → fromBottom [41, 222, 422, 622]", () => {
    const panelH = 762;
    const drawers4 = [
      { posYMm: -300, frontHeightMm: 200 },
      { posYMm: -100, frontHeightMm: 200 },
      { posYMm: 100, frontHeightMm: 200 },
      { posYMm: 300, frontHeightMm: 200 },
    ];
    const fromTop = resolveEuropeanModuleRunnerLinesYMm({
      panelHeightMm: panelH,
      boxInternalHeightMm: 800,
      boxExternalHeightMm: 800,
      floorThicknessMm: 19,
      drawers: drawers4,
    });
    const fromBottom = fromTop.map((y) => panelH - y);
    expect(fromBottom[0]).toBeCloseTo(41, 5);
    expect(fromBottom[1]).toBeCloseTo(222, 5);
    expect(fromBottom[2]).toBeCloseTo(422, 5);
    expect(fromBottom[3]).toBeCloseTo(622, 5);
  });

  it("modo eixo_desde_frente preserva 1.ª ≈ 41 (legado)", () => {
    const panelH = 762;
    const H = 800;
    const heights = [263.333, 263.333, 263.333];
    const drawers = heights.map((h, i) => {
      // Stack sintético com B0=0 local; VERTICAL_BASE_OFFSET (B0 SSOT=2) ainda entra no legado.
      let offset = 0;
      for (let j = 0; j < i; j++) offset += heights[j]! + 4;
      return {
        posYMm: -H / 2 + offset + h / 2,
        frontHeightMm: h,
      };
    });
    const fromTop = resolveEuropeanModuleRunnerLinesYMm({
      panelHeightMm: panelH,
      boxInternalHeightMm: H,
      drawers,
      corredicaModoCalculo: "eixo_desde_frente",
    });
    const fromBottom = fromTop.map((y) => panelH - y);
    expect(fromBottom[0]).toBeCloseTo(41, 3);
    // Upper: 22,5 + (bottom − B0_SSOT); B0=2 → 287,833
    expect(fromBottom[1]).toBeCloseTo(287.833, 1);
  });
});
