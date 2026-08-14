/**
 * Diff 2+3 — corpo gavita 8 com frentes equal_quase.
 */
import { describe, expect, it } from "vitest";
import { calculateDrawerSpecs } from "../core/drawers/DrawerParametrics";
import { calculateDrawerHeights } from "../core/drawers/DrawerGroup";
import {
  DRAWER_BODY_DELTA_LOWEST_MM,
  DRAWER_BODY_DELTA_UPPER_MM,
  DRAWER_BODY_ELEVATION_FROM_FRONT_MM,
  DRAWER_COSTA_HEIGHT_BELOW_LATERAL_MM,
} from "../core/drawers/drawerGeometryConstants";
import {
  resolveDrawerBodyDeltaForStackRoleMm,
  resolveDrawerBodyElevationForStackRoleMm,
} from "../core/drawers/drawerStackPosition";
import { computeDrawerFrenteExtStructuralHoles } from "../core/drawers/drilling/DrawerDrillingRules";
import { settingsDefaults } from "../core/settings/settingsSchema";

const DEPTHS = settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm;

function baseDims(frontHeight: number, stackRole: "lowest" | "middle" | "highest") {
  return {
    boxInternalWidth: 600 - 2 * 19,
    boxExternalWidth: 600,
    boxInternalHeight: 800,
    boxInternalDepth: 471,
    boxThickness: 19,
    drawerHeight: frontHeight,
    totalDrawers: 3,
    stackRole,
    type: "normal" as const,
  };
}

describe("Diff 2+3 — corpo gavita 8", () => {
  it("constantes industriais", () => {
    expect(DRAWER_BODY_ELEVATION_FROM_FRONT_MM).toBe(48);
    expect(DRAWER_BODY_DELTA_LOWEST_MM).toBe(85.5);
    expect(DRAWER_BODY_DELTA_UPPER_MM).toBe(68.5);
    expect(DRAWER_COSTA_HEIGHT_BELOW_LATERAL_MM).toBe(23);
    expect(resolveDrawerBodyElevationForStackRoleMm("lowest")).toBe(48);
    expect(resolveDrawerBodyElevationForStackRoleMm("middle")).toBe(48);
    expect(resolveDrawerBodyElevationForStackRoleMm("highest")).toBe(48);
    expect(resolveDrawerBodyElevationForStackRoleMm("single")).toBe(48);
    expect(resolveDrawerBodyDeltaForStackRoleMm("lowest")).toBe(85.5);
    expect(resolveDrawerBodyDeltaForStackRoleMm("middle")).toBe(68.5);
  });

  it("laterais 177,17 / 196,17 / 196,17 e costas 154,17 / 173,17 / 173,17", () => {
    const fronts = calculateDrawerHeights(3, 800, "equal");
    expect(fronts[0]).toBeCloseTo(262.6666667, 5);
    expect(fronts[1]).toBeCloseTo(264.6666667, 5);
    expect(fronts[2]).toBeCloseTo(264.6666667, 5);

    const s1 = calculateDrawerSpecs(baseDims(fronts[0]!, "lowest"), DEPTHS);
    const s2 = calculateDrawerSpecs(baseDims(fronts[1]!, "middle"), DEPTHS);
    const s3 = calculateDrawerSpecs(baseDims(fronts[2]!, "highest"), DEPTHS);

    expect(s1.leftSide.height).toBeCloseTo(177.1666667, 5);
    expect(s1.rightSide.height).toBeCloseTo(177.1666667, 5);
    expect(s1.back.height).toBeCloseTo(154.1666667, 5);
    expect(s1.sideBaseElevationMm).toBe(48);

    expect(s2.leftSide.height).toBeCloseTo(196.1666667, 5);
    expect(s2.back.height).toBeCloseTo(173.1666667, 5);
    expect(s2.sideBaseElevationMm).toBe(48);

    expect(s3.leftSide.height).toBeCloseTo(196.1666667, 5);
    expect(s3.back.height).toBeCloseTo(173.1666667, 5);
    expect(s3.sideBaseElevationMm).toBe(48);

    expect(s2.leftSide.height).toBeCloseTo(s3.leftSide.height, 5);
    expect(s2.back.height).toBeCloseTo(s3.back.height, 5);
  });

  it("furos frente GAV_1: Y = 63 e 190,17 com elev=48", () => {
    const sideH = 177.1666667;
    const elev = 48;
    const holes = computeDrawerFrenteExtStructuralHoles({
      largura: 592,
      altura: 262.6666667,
      espessura: 19,
      sideHeightMm: sideH,
      bodyWidthMm: 548,
      sideThicknessMm: 16,
      bottomThicknessMm: 10,
      sideBaseElevationMm: elev,
      stackRole: "lowest",
    });
    const type1Ys = [
      ...new Set(
        holes
          .filter((h) => h.tipo === "cavilha" || (h.diametro === 10 && h.profundidade === 13))
          .map((h) => Number(h.y))
      ),
    ].sort((a, b) => a - b);
    expect(type1Ys).toContainEqual(expect.closeTo(63, 5));
    expect(type1Ys.some((y) => Math.abs(y - 190.1666667) < 0.05)).toBe(true);
    expect(Math.min(...type1Ys)).toBeCloseTo(63, 5);
    expect(Math.max(...type1Ys.filter((y) => y < 250))).toBeCloseTo(190.1666667, 5);
  });
});
