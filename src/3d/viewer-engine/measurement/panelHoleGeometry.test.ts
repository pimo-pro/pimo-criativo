import { describe, expect, it } from "vitest";
import type { TechnicalDrillHole } from "../../../core/types";
import { holeLocalB, usesViewerBottomOriginY } from "./panelHoleGeometry";

function hole(
  partial: Partial<TechnicalDrillHole> & Pick<TechnicalDrillHole, "tipo" | "y">
): TechnicalDrillHole {
  return {
    x: 100,
    diametro: 10,
    profundidade: 13,
    face: "tras",
    ...partial,
  } as TechnicalDrillHole;
}

describe("panelHoleGeometry — visual Y na frente (viewer only)", () => {
  const panelH = 0.2; // 200 mm

  it("usesViewerBottomOriginY: rasgo estrutural na frente = BL", () => {
    expect(usesViewerBottomOriginY("front", { tipo: "fixacao_estrutural" })).toBe(true);
    expect(usesViewerBottomOriginY("front", { tipo: "cavilha" })).toBe(true);
    expect(usesViewerBottomOriginY("front", { tipo: "puxador" })).toBe(false);
  });

  it("rasgo perto do topo industrial (Y alto BL) aparece no topo do mesh", () => {
    // elev+sideH-13 ≈ 185 mm numa frente de 200 mm
    const b = holeLocalB("front", panelH, hole({ tipo: "fixacao_estrutural", y: 185 }));
    expect(b).toBeCloseTo(185 / 1000 - 0.1, 5); // ≈ +0.085 (acima do centro)
    expect(b).toBeGreaterThan(0);
  });

  it("puxador Topo (Y desde o topo) mantém conversão topo→centro", () => {
    const b = holeLocalB("front", panelH, hole({ tipo: "puxador", y: 40 }));
    expect(b).toBeCloseTo(0.1 - 0.04, 5); // ≈ +0.06 (perto do topo)
  });
});
