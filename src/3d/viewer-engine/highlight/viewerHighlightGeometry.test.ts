import { describe, it, expect } from "vitest";
import {
  createHoleCircleGeometry,
  createPanelContourGeometry,
  holeMmToLocalMeters,
  type PanelOutlineDims,
} from "./viewerHighlightGeometry";
import type { TechnicalDrillHole } from "../../../core/types";
import {
  assertViewerHighlightInvariants,
  findSpuriousSegmentsInGeometry,
} from "./viewerHighlightInvariant";

const SEP_DIMS: PanelOutlineDims = {
  width: 0.5,
  height: 0.4,
  thickness: 0.019,
};

function edgeCavilha(xMm: number, yMm: number, face: "esquerda" | "direita"): TechnicalDrillHole {
  return {
    x: xMm,
    y: yMm,
    diametro: 8,
    profundidade: 30,
    tipo: "cavilha",
    face,
  };
}

describe("viewerHighlightGeometry — contorno separado de furos", () => {
  it("contorno e furo produzem geometrias distintas (sem merge)", () => {
    const contour = createPanelContourGeometry("top", SEP_DIMS);
    const hole = createHoleCircleGeometry("top", SEP_DIMS, edgeCavilha(10, 30, "esquerda"));
    expect(contour).not.toBeNull();
    expect(hole).not.toBeNull();
    expect(contour!.getAttribute("position").count).not.toBe(hole!.getAttribute("position").count);
  });

  it("cavilha na espessura (face esquerda) fica na borda X, não no topo Y", () => {
    const hole = edgeCavilha(10, 30, "esquerda");
    const local = holeMmToLocalMeters("top", SEP_DIMS, hole);
    expect(local).not.toBeNull();
    expect(Math.abs(local!.x + SEP_DIMS.width / 2)).toBeLessThan(0.002);
    expect(Math.abs(local!.y + SEP_DIMS.thickness / 2)).toBeGreaterThan(0.001);
  });

  it("cavilha na espessura direita fica em +X da peça", () => {
    const hole = edgeCavilha(SEP_DIMS.width * 1000 - 10, 30, "direita");
    const local = holeMmToLocalMeters("top", SEP_DIMS, hole);
    expect(local).not.toBeNull();
    expect(Math.abs(local!.x - SEP_DIMS.width / 2)).toBeLessThan(0.002);
  });

  it("geometria de um único furo não tem segmentos longos espúrios", () => {
    const geo = createHoleCircleGeometry("top", SEP_DIMS, edgeCavilha(10, 30, "esquerda"));
    expect(geo).not.toBeNull();
    const positions = geo!.getAttribute("position").array as Float32Array;
    const bad = findSpuriousSegmentsInGeometry(positions, 0.05);
    expect(bad).toEqual([]);
  });

  it("dois furos SEP não partilham LineSegments (regressão linhas pretas)", () => {
    const h1 = createHoleCircleGeometry("top", SEP_DIMS, edgeCavilha(10, 30, "esquerda"));
    const h2 = createHoleCircleGeometry("top", SEP_DIMS, edgeCavilha(490, 30, "direita"));
    expect(h1).not.toBeNull();
    expect(h2).not.toBeNull();
    expect(h1).not.toBe(h2);
  });
});

describe("viewerHighlightInvariant", () => {
  it("aceita overlays de furo face-aware sem violações", () => {
    const holes = [edgeCavilha(10, 30, "esquerda")];
    const geo = createHoleCircleGeometry("top", SEP_DIMS, holes[0])!;
    const positions = geo.getAttribute("position").array as Float32Array;
    const violations = assertViewerHighlightInvariants(
      "sep-test",
      "uuid-sep",
      "top",
      SEP_DIMS,
      holes,
      [{ isIndustrialDesignHoleOverlay: true, parentPieceUuid: "uuid-sep" }],
      [{ positions }],
      { maxSpuriousSegmentLengthM: 0.08 }
    );
    expect(violations).toEqual([]);
  });

  it("furo face esquerda com x central resolve na borda (não no topo)", () => {
    const local = holeMmToLocalMeters(
      "top",
      SEP_DIMS,
      edgeCavilha(SEP_DIMS.width * 500, 30, "esquerda")
    );
    expect(local).not.toBeNull();
    expect(Math.abs(local!.x + SEP_DIMS.width / 2)).toBeLessThan(0.002);
    expect(Math.abs(local!.y)).toBeLessThan(0.002);
  });

  it("furo em painel lateral rotacionado (left) fica na face exterior X", () => {
    const lateralDims: PanelOutlineDims = {
      width: 0.4,
      height: 0.7,
      thickness: 0.019,
    };
    const hole: TechnicalDrillHole = {
      x: 50,
      y: 100,
      diametro: 5,
      profundidade: 12,
      tipo: "prateleira",
      face: "esquerda",
    };
    const local = holeMmToLocalMeters("left", lateralDims, hole);
    expect(local).not.toBeNull();
    expect(Math.abs(local!.x - lateralDims.thickness / 2)).toBeLessThan(0.002);
    const geo = createHoleCircleGeometry("left", lateralDims, hole);
    expect(geo).not.toBeNull();
    const positions = geo!.getAttribute("position").array as Float32Array;
    expect(findSpuriousSegmentsInGeometry(positions, 0.05)).toEqual([]);
  });
});
