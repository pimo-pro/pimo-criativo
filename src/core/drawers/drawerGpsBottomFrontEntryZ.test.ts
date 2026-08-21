import { describe, expect, it } from "vitest";
import { DRAWER_BOTTOM_FRONT_ENTRY_MM } from "./drawerGeometryConstants";
import {
  resolveDrawerBottomCenterZFrontEntryMm,
  resolveDrawerBottomCenterZMm,
} from "./drawerViewerLayout";

describe("gav_fundo — âncora frente (entrada 10 mm)", () => {
  it("bordo dianteiro = face traseira da frente + 10 mm", () => {
    const frontT = 19;
    const bottomDepth = 466;
    const centerZ = resolveDrawerBottomCenterZFrontEntryMm(frontT, bottomDepth);
    const frontEdge = centerZ + bottomDepth / 2;
    expect(frontEdge).toBeCloseTo(-(frontT / 2) + DRAWER_BOTTOM_FRONT_ENTRY_MM, 5);
  });

  it("âncora traseira flush (legado) avança ~T_costa face à entrada 10 mm", () => {
    const frontT = 19;
    const sideDepth = 440;
    const bottomDepth = 466;
    const rearFlush = resolveDrawerBottomCenterZMm(frontT, sideDepth, bottomDepth);
    const frontEntry = resolveDrawerBottomCenterZFrontEntryMm(frontT, bottomDepth);
    expect(frontEntry).not.toBeCloseTo(rearFlush, 5);

    const rearFrontEdge = rearFlush + bottomDepth / 2;
    const entryFrontEdge = frontEntry + bottomDepth / 2;
    expect(rearFrontEdge - entryFrontEdge).toBeCloseTo(16, 5);
  });
});
