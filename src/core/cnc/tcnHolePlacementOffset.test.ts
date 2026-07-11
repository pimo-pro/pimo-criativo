import { describe, expect, it } from "vitest";
import { tcnHoleLocalToSheetOffsetMm } from "./tcnHolePlacementOffset";
import { holeLocalToSheetOffsetMm } from "../cutlayout/layoutCoordinateSystem";

const PIECE_W = 400;
const PIECE_H = 300;

describe("tcnHoleLocalToSheetOffsetMm", () => {
  it("rot=0 — igual ao v1 com placement dims", () => {
    const pl = { largura_mm: PIECE_W, altura_mm: PIECE_H, rotacao: 0, metadata: {} };
    const expected = holeLocalToSheetOffsetMm(10, 20, 0, PIECE_W, PIECE_H);
    expect(tcnHoleLocalToSheetOffsetMm(10, 20, pl)).toEqual(expected);
  });

  it("rot=90 — usa design dims de metadata quando presentes", () => {
    const pl = {
      largura_mm: PIECE_H,
      altura_mm: PIECE_W,
      rotacao: 90,
      metadata: { holeDesignLarguraMm: PIECE_W, holeDesignAlturaMm: PIECE_H },
    };
    const expected = holeLocalToSheetOffsetMm(10, 20, 90, PIECE_H, PIECE_W, PIECE_W, PIECE_H);
    expect(tcnHoleLocalToSheetOffsetMm(10, 20, pl)).toEqual(expected);
  });

  it("peça pré-normalizada (tallPiecePreNormalized) — metadata design intacto", () => {
    const designW = 200;
    const designH = 80;
    const pl = {
      largura_mm: designW,
      altura_mm: designH,
      rotacao: 0,
      metadata: {
        holeDesignLarguraMm: designW,
        holeDesignAlturaMm: designH,
        tallPiecePreNormalized: true,
      },
    };
    expect(tcnHoleLocalToSheetOffsetMm(30, 70, pl)).toEqual({ sx: 30, sy: 70 });
  });
});
