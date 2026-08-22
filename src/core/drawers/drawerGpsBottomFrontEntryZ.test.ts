import { describe, expect, it } from "vitest";
import { DRAWER_BOTTOM_FRONT_ENTRY_MM } from "./drawerGeometryConstants";
import {
  resolveDrawerBottomCenterZFrontEntryMm,
  resolveDrawerBottomCenterZMm,
} from "./drawerViewerLayout";

describe("gav_fundo — âncora frente (entrada 10 mm)", () => {
  it("bordo dianteiro = face traseira da frente + 10 mm", () => {
    const frontT = 19;
    const bottomDepth = 450;
    const centerZ = resolveDrawerBottomCenterZFrontEntryMm(frontT, bottomDepth);
    const frontEdge = centerZ + bottomDepth / 2;
    expect(frontEdge).toBeCloseTo(-(frontT / 2) + DRAWER_BOTTOM_FRONT_ENTRY_MM, 5);
  });

  it("sideDepth+10: âncora frente e traseira flush coincidem no centro Z", () => {
    const frontT = 19;
    const sideDepth = 440;
    const bottomDepth = sideDepth + DRAWER_BOTTOM_FRONT_ENTRY_MM;
    const rearFlush = resolveDrawerBottomCenterZMm(frontT, sideDepth, bottomDepth);
    const frontEntry = resolveDrawerBottomCenterZFrontEntryMm(frontT, bottomDepth);
    expect(frontEntry).toBeCloseTo(rearFlush, 5);

    const rearEdge = frontEntry - bottomDepth / 2;
    expect(rearEdge).toBeCloseTo(-(frontT / 2 + sideDepth), 5);
  });
});
