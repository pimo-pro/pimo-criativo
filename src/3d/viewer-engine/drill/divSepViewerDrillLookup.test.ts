import { describe, expect, it } from "vitest";
import type { TechnicalDrillHole } from "../../../core/types";
import {
  filterDivisorViewerShelfHoles,
  resolveDivisorManufacturingPanelId,
  resolveDivisorViewerDrillHoles,
  resolveDivisorViewerPanelType,
} from "./divSepViewerDrillLookup";

const sampleHole = (
  face: TechnicalDrillHole["face"],
  tipo: TechnicalDrillHole["tipo"] = "prateleira"
): TechnicalDrillHole => ({
  x: 60,
  y: 200,
  diametro: 5,
  profundidade: 13,
  tipo,
  face,
});

describe("divSepViewerDrillLookup", () => {
  it("resolve panelId industrial igual à cutlist (fallback divisorio-N)", () => {
    expect(resolveDivisorManufacturingPanelId(undefined, 0)).toBe("divisorio-1");
    expect(resolveDivisorManufacturingPanelId({ divisores: [] }, 0)).toBe("divisorio-1");
    expect(resolveDivisorManufacturingPanelId({ divisores: ["pid-div-a"] }, 0)).toBe("pid-div-a");
  });

  it("encontra furos via panelId cutlist mesmo quando mesh usa div.id", () => {
    const holes = [sampleHole("direita"), sampleHole("direita")];
    const map = { "divisorio-1": holes };
    const resolved = resolveDivisorViewerDrillHoles(map, {
      divItemId: "uuid-runtime-div",
      divIndex: 0,
      panelIds: { divisores: [] },
    });
    expect(resolved).toBe(holes);
    expect(resolved.length).toBe(2);
  });

  it("aceita fallback por div.id quando o mapa está indexado pelo id da mesh", () => {
    const holes = [sampleHole("esquerda")];
    const map = { "uuid-runtime-div": holes };
    const resolved = resolveDivisorViewerDrillHoles(map, {
      divItemId: "uuid-runtime-div",
      divIndex: 0,
    });
    expect(resolved).toEqual(holes);
  });

  it("mapeia prateleiraLado para panelType vertical", () => {
    expect(resolveDivisorViewerPanelType("direita")).toBe("left");
    expect(resolveDivisorViewerPanelType("esquerda")).toBe("right");
    expect(resolveDivisorViewerPanelType(undefined)).toBe("left");
  });

  it("nunca devolve top/generic para DIV — só left ou right", () => {
    const types = ["direita", "esquerda", undefined] as const;
    for (const lado of types) {
      const panelType = resolveDivisorViewerPanelType(lado);
      expect(panelType === "left" || panelType === "right").toBe(true);
      expect(panelType).not.toBe("top");
      expect(panelType).not.toBe("bottom");
      expect(panelType).not.toBe("front");
    }
  });

  it("filterDivisorViewerShelfHoles mantém só prateleira (sem cavilhas)", () => {
    const mixed = [
      sampleHole("direita", "prateleira"),
      sampleHole("direita", "cavilha"),
      sampleHole("esquerda", "prateleira"),
    ];
    const filtered = filterDivisorViewerShelfHoles(mixed);
    expect(filtered).toHaveLength(2);
    expect(filtered.every((h) => h.tipo === "prateleira")).toBe(true);
    expect(filterDivisorViewerShelfHoles([])).toEqual([]);
    expect(filterDivisorViewerShelfHoles(undefined)).toEqual([]);
  });
});
