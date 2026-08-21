import { describe, expect, it } from "vitest";
import {
  resolveDrawerBackCenterZMm,
  resolveDrawerBottomCenterZMm,
} from "./drawerViewerLayout";

describe("gav_fundo datum Z — traseira flush", () => {
  it("bordo traseiro do fundo = face traseira das laterais (sideDepth 440, bottom 466)", () => {
    const frontT = 19;
    const sideDepth = 440;
    const bottomDepth = 466; // sideDepth + 10 + 16
    const centerZ = resolveDrawerBottomCenterZMm(frontT, sideDepth, bottomDepth);
    const rearEdge = centerZ - bottomDepth / 2;
    const sideRear = -(frontT / 2 + sideDepth);
    expect(rearEdge).toBeCloseTo(sideRear, 5);

    const backCenter = resolveDrawerBackCenterZMm(frontT, sideDepth, 16);
    const costaRear = backCenter - 16 / 2;
    expect(rearEdge).toBeCloseTo(costaRear, 5);
  });
});
