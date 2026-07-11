import { describe, it, expect } from "vitest";
import {
  assertKnownPieceMesh,
  assertViewerHighlightInvariants,
  findSpuriousSegmentsInGeometry,
} from "./viewerHighlightInvariant";
import {
  createHoleCircleGeometry,
  type PanelOutlineDims,
} from "./viewerHighlightGeometry";
import type { TechnicalDrillHole } from "../../../core/types";

const TOP_DIMS: PanelOutlineDims = {
  width: 0.5,
  height: 0.4,
  thickness: 0.019,
};

function cavilha(xMm: number, yMm: number, face: "esquerda" | "direita"): TechnicalDrillHole {
  return {
    x: xMm,
    y: yMm,
    diametro: 8,
    profundidade: 30,
    tipo: "cavilha",
    face,
  };
}

describe("HIGHLIGHT_WITHOUT_HOLES", () => {
  it("detecta overlay de furo quando SSOT não tem furos", () => {
    const violations = assertViewerHighlightInvariants(
      "mesh-1",
      "uuid-1",
      "top",
      TOP_DIMS,
      [],
      [{ isIndustrialDesignHoleOverlay: true, parentPieceUuid: "uuid-1" }],
      [],
      { holesOnlyMode: true }
    );
    expect(violations.some((v) => v.code === "HIGHLIGHT_WITHOUT_HOLES")).toBe(true);
  });
});

describe("HIGHLIGHT_WITHOUT_PIECE_MESH", () => {
  it("detecta tentativa de highlight em mesh desconhecida", () => {
    const violations = assertKnownPieceMesh("layout-proxy", false);
    expect(violations).toHaveLength(1);
    expect(violations[0].code).toBe("HIGHLIGHT_WITHOUT_PIECE_MESH");
  });
});

describe("HIGHLIGHT_ORPHAN_OVERLAY", () => {
  it("detecta overlay de furo com parentPieceUuid errado", () => {
    const holes = [cavilha(10, 30, "esquerda")];
    const geo = createHoleCircleGeometry("top", TOP_DIMS, holes[0])!;
    const positions = geo.getAttribute("position").array as Float32Array;
    const violations = assertViewerHighlightInvariants(
      "mesh-1",
      "uuid-parent",
      "top",
      TOP_DIMS,
      holes,
      [{ isIndustrialDesignHoleOverlay: true, parentPieceUuid: "uuid-outro" }],
      [{ positions }],
      { maxSpuriousSegmentLengthM: 0.08 }
    );
    expect(violations.some((v) => v.code === "HIGHLIGHT_ORPHAN_OVERLAY")).toBe(true);
  });
});

describe("HIGHLIGHT_SPURIOUS_SEGMENT", () => {
  it("detecta segmento longo que ligaria furos distintos", () => {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0]);
    const bad = findSpuriousSegmentsInGeometry(positions, 0.05);
    expect(bad).toEqual([0]);
  });

  it("círculo de furo isolado não gera segmentos espúrios", () => {
    const geo = createHoleCircleGeometry("top", TOP_DIMS, cavilha(10, 30, "esquerda"));
    const positions = geo!.getAttribute("position").array as Float32Array;
    const bad = findSpuriousSegmentsInGeometry(positions, 0.05);
    expect(bad).toEqual([]);
  });
});

describe("HIGHLIGHT_FACE_MISMATCH", () => {
  it("aceita cavilha face esquerda na borda X da peça", () => {
    const holes = [cavilha(10, 30, "esquerda")];
    const geo = createHoleCircleGeometry("top", TOP_DIMS, holes[0])!;
    const positions = geo.getAttribute("position").array as Float32Array;
    const violations = assertViewerHighlightInvariants(
      "sep-top",
      "uuid-sep",
      "top",
      TOP_DIMS,
      holes,
      [{ isIndustrialDesignHoleOverlay: true, parentPieceUuid: "uuid-sep" }],
      [{ positions }],
      { maxSpuriousSegmentLengthM: 0.08 }
    );
    expect(violations.filter((v) => v.code === "HIGHLIGHT_FACE_MISMATCH")).toEqual([]);
  });
});
