import { describe, expect, it } from "vitest";
import { dedupeDrillHoles } from "./drillHoleDedup";
import { mergeDrillHoles } from "../../core/divSep/drilling";

describe("dedupeDrillHoles", () => {
  it("remove furos na mesma posição (tol 0,5 mm)", () => {
    const holes = [
      { x: 10, y: 20, diameter: 5, depth: 12, holeType: "prateleira" as const },
      { x: 10.3, y: 20.2, diameter: 5, depth: 12, holeType: "prateleira" as const },
    ];
    expect(dedupeDrillHoles(holes)).toHaveLength(1);
  });

  it("mantém furos no mesmo (x,y) com topDrillable diferente", () => {
    const holes = [
      { x: 10, y: 20, diameter: 5, depth: 12, topDrillable: true },
      { x: 10, y: 20, diameter: 5, depth: 12, topDrillable: false },
    ];
    expect(dedupeDrillHoles(holes)).toHaveLength(2);
  });

  it("em conflito na mesma posição, prefere dobradiça sobre prateleira", () => {
    const holes = [
      { x: 50, y: 100, diameter: 5, depth: 12, holeType: "prateleira" as const },
      { x: 50, y: 100, diameter: 5, depth: 12, holeType: "dobradica" as const },
    ];
    const out = dedupeDrillHoles(holes);
    expect(out).toHaveLength(1);
    expect(out[0]?.holeType).toBe("dobradica");
  });
});

describe("mergeDrillHoles — dedup integrado", () => {
  it("deduplica após concatenação base + extra", () => {
    const base = [{ x: 60, y: 400, diameter: 5, depth: 13, holeType: "prateleira" as const }];
    const extra = [{ x: 60.2, y: 400.1, diameter: 5, depth: 13, holeType: "prateleira" as const }];
    const merged = mergeDrillHoles(base, extra);
    expect(merged).toHaveLength(1);
  });
});
