import { describe, expect, it } from "vitest";
import type { CutPlacement } from "../cutLayoutTypes";
import type { V3Placement } from "../../../nesting-v3/nestingV3Types";
import {
  cutPlacementToV3Placement,
  v3PlacementToCutPlacement,
  physicalBlToV3TopLeft,
  solverUsableToPhysicalBl,
  physicalBlToSolverUsable,
  coordinatesWithinTolerance,
} from "./layoutCoordinateAdapter";

const TOL = 0.01;

describe("layoutCoordinateAdapter", () => {
  it("converte BL físico → TL canvas", () => {
    const pl: CutPlacement = {
      x_mm: 10,
      y_mm: 20,
      largura_mm: 100,
      altura_mm: 50,
      rotacao: 0,
      sheetIndex: 0,
      boxId: "box-1",
      partName: "Lateral",
      metadata: { v3PieceId: "v3-1" },
    };
    const v3 = cutPlacementToV3Placement(pl, 1000);
    expect(v3.pieceId).toBe("v3-1");
    expect(v3.xMm).toBe(10);
    expect(v3.yMm).toBe(930);
    expect(v3.rotated).toBe(false);
  });

  it("round-trip BL → TL → BL (≤ 0,01 mm)", () => {
    const sheetH = 2070;
    const pl: CutPlacement = {
      x_mm: 15.125,
      y_mm: 40.375,
      largura_mm: 600,
      altura_mm: 400.5,
      rotacao: 90,
      sheetIndex: 0,
      boxId: "box-1",
      partName: "Prateleira",
      metadata: { v3PieceId: "v3-2" },
    };
    const v3 = cutPlacementToV3Placement(pl, sheetH);
    const back = v3PlacementToCutPlacement(v3, pl.altura_mm, sheetH);
    expect(coordinatesWithinTolerance(back.x_mm, pl.x_mm, TOL)).toBe(true);
    expect(coordinatesWithinTolerance(back.y_mm, pl.y_mm, TOL)).toBe(true);
  });

  it("round-trip TL → BL → TL (≤ 0,01 mm)", () => {
    const sheetH = 2070;
    const pieceH = 400.5;
    const blX = 15.125;
    const blY = 40.375;
    const tl = physicalBlToV3TopLeft(blX, blY, pieceH, sheetH);
    const v3: V3Placement = {
      pieceId: "v3-2",
      sheetIndex: 0,
      xMm: tl.xMm,
      yMm: tl.yMm,
      rotated: true,
    };
    const bl = v3PlacementToCutPlacement(v3, pieceH, sheetH);
    const tlBack = physicalBlToV3TopLeft(bl.x_mm, bl.y_mm, pieceH, sheetH);
    expect(coordinatesWithinTolerance(tlBack.xMm, v3.xMm, TOL)).toBe(true);
    expect(coordinatesWithinTolerance(tlBack.yMm, v3.yMm, TOL)).toBe(true);
  });

  it("solver-usable ↔ physical BL com margem", () => {
    const margin = 10;
    const usable = { x: 5, y: 8 };
    const physical = solverUsableToPhysicalBl(usable.x, usable.y, margin);
    expect(physical.x_mm).toBe(15);
    expect(physical.y_mm).toBe(18);
    const back = physicalBlToSolverUsable(physical.x_mm, physical.y_mm, margin);
    expect(back.x).toBe(usable.x);
    expect(back.y).toBe(usable.y);
  });
});
