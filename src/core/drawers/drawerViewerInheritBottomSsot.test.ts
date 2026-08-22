import { describe, expect, it } from "vitest";
import {
  resolveDrawerBottomCenterZMm,
  resolveDrawerViewerWoodBottomBackLayoutMm,
} from "./drawerViewerLayout";

describe("Fase C — Viewer herda SSOT do gav_fundo", () => {
  it("floorWidth/Depth/PosZ vêm do industrial; costa mantém backWidth (vão)", () => {
    const bottomWidthMm = 534;
    const bottomDepthMm = 450;
    const sideDepthMm = 440;
    const frontT = 19;
    const bottomPosZMm = resolveDrawerBottomCenterZMm(frontT, sideDepthMm, bottomDepthMm);

    const layout = resolveDrawerViewerWoodBottomBackLayoutMm({
      sidePosYMm: 0,
      sideHeightMm: 150,
      internalWidthMm: 562,
      sideThicknessMm: 16,
      bodyDepthMm: 450,
      sideDepthMm,
      combinedFrontThicknessMm: frontT,
      floorThicknessMm: 10,
      backThicknessMm: 16,
      bottomWidthMm,
      bottomDepthMm,
      bottomPosZMm,
      backWidthMm: 516,
    });

    expect(layout.floorWidthMm).toBe(534);
    expect(layout.floorDepthMm).toBe(450);
    expect(layout.floorPosZMm).toBeCloseTo(bottomPosZMm, 5);
    expect(layout.backWidthMm).toBe(516);

    const rearEdge = layout.floorPosZMm - layout.floorDepthMm / 2;
    expect(rearEdge).toBeCloseTo(-(frontT / 2 + sideDepthMm), 5);
  });
});
