import { describe, expect, it } from "vitest";
import {
  calculateErgonomicDrawerHeights,
  calculateDrawerHeights,
  ERGONOMIC_MAX_DRAWER_HEIGHT_MM,
  ERGONOMIC_MIN_DRAWER_HEIGHT_MM,
  getDrawerUsableInternalHeightMm,
} from "../core/drawers";
import { DRAWER_VERTICAL_GAP_MM } from "../core/drawers/drawerGeometryConstants";
import { sumDrawerFrontHeightsAndGaps } from "../core/drawers/drawerModuleGeometry";

const BOX_H = 720;
const USABLE = getDrawerUsableInternalHeightMm(BOX_H);

function sumWithGaps(heights: number[]) {
  return sumDrawerFrontHeightsAndGaps(heights, DRAWER_VERTICAL_GAP_MM);
}

describe("drawerErgonomicsHeights", () => {
  it.each([2, 3, 4, 5] as const)("modo ergonomic — %i gavetas respeitam min/max e soma útil", (count) => {
    const heights = calculateErgonomicDrawerHeights({
      drawerCount: count,
      usableHeightMm: USABLE,
      mode: "ergonomic",
    });
    expect(heights).toHaveLength(count);
    heights.forEach((h) => {
      expect(h).toBeGreaterThanOrEqual(ERGONOMIC_MIN_DRAWER_HEIGHT_MM - 0.5);
      expect(h).toBeLessThanOrEqual(ERGONOMIC_MAX_DRAWER_HEIGHT_MM + 0.5);
    });
    expect(sumWithGaps(heights)).toBeLessThanOrEqual(USABLE + 0.5);
    expect(heights.reduce((a, h) => a + h, 0)).toBeLessThanOrEqual(count * ERGONOMIC_MAX_DRAWER_HEIGHT_MM + 0.5);
    if (count >= 2) {
      expect(heights[count - 1]!).toBeGreaterThanOrEqual(heights[0]!);
    }
  });

  it("modo kitchen_zones — gaveta inferior ≥ gaveta superior", () => {
    const heights = calculateErgonomicDrawerHeights({
      drawerCount: 4,
      usableHeightMm: USABLE,
      mode: "kitchen_zones",
    });
    expect(heights[3]!).toBeGreaterThan(heights[0]!);
    expect(heights[3]!).toBeGreaterThanOrEqual(ERGONOMIC_MIN_DRAWER_HEIGHT_MM);
  });

  it("modo auto — blend entre ergonomic e kitchen_zones", () => {
    const ergonomic = calculateErgonomicDrawerHeights({
      drawerCount: 3,
      usableHeightMm: USABLE,
      mode: "ergonomic",
    });
    const kitchen = calculateErgonomicDrawerHeights({
      drawerCount: 3,
      usableHeightMm: USABLE,
      mode: "kitchen_zones",
    });
    const auto = calculateErgonomicDrawerHeights({
      drawerCount: 3,
      usableHeightMm: USABLE,
      mode: "auto",
    });
    expect(auto).not.toEqual(ergonomic);
    expect(auto).not.toEqual(kitchen);
    expect(sumWithGaps(auto)).toBeCloseTo(USABLE, 0);
  });

  it("calculateDrawerHeights delega modos ergonómicos sem alterar equal_quase/custom", () => {
    const equal = calculateDrawerHeights(3, BOX_H, "equal");
    const ergonomic = calculateDrawerHeights(3, BOX_H, "ergonomic");
    // equal = equal_quase: 1.ª frente −2 mm vs restantes
    expect(equal[1]).toBeCloseTo(equal[2]!, 5);
    expect(equal[0]!).toBeLessThan(equal[1]!);
    expect(ergonomic).not.toEqual(equal);
    expect(ergonomic[2]!).toBeGreaterThan(ergonomic[0]!);
  });
});

describe("distribuições de referência (módulo 720 mm; útil = 720−B0)", () => {
  const round = (vals: number[]) => vals.map((v) => Math.round(v));

  it("2 gavetas — ergonomic (limite máx. 350 mm)", () => {
    const h = round(
      calculateErgonomicDrawerHeights({ drawerCount: 2, usableHeightMm: USABLE, mode: "ergonomic" })
    );
    expect(h[1]).toBeGreaterThanOrEqual(h[0]!);
    expect(h).toEqual([350, 350]);
  });

  it("3 gavetas — ergonomic", () => {
    const h = round(
      calculateErgonomicDrawerHeights({ drawerCount: 3, usableHeightMm: USABLE, mode: "ergonomic" })
    );
    expect(h[0]).toBeLessThan(h[1]!);
    expect(h[1]).toBeLessThan(h[2]!);
    expect(h).toEqual([124, 236, 350]);
  });

  it("4 gavetas — kitchen_zones", () => {
    const h = round(
      calculateErgonomicDrawerHeights({ drawerCount: 4, usableHeightMm: USABLE, mode: "kitchen_zones" })
    );
    expect(h[0]).toBeLessThan(h[3]!);
    expect(h).toEqual([99, 155, 212, 240]);
  });

  it("5 gavetas — auto", () => {
    const h = round(
      calculateErgonomicDrawerHeights({ drawerCount: 5, usableHeightMm: USABLE, mode: "auto" })
    );
    expect(h).toHaveLength(5);
    expect(h[4]).toBeGreaterThanOrEqual(ERGONOMIC_MIN_DRAWER_HEIGHT_MM);
    expect(h[4]!).toBeGreaterThan(h[0]!);
    expect(h).toEqual([87, 135, 180, 150, 150]);
  });
});
