/**
 * Diff 2+3 — corpo gavita 8 com frentes equal_quase (B0=2, elev lowest=16,5).
 */
import { describe, expect, it } from "vitest";
import { calculateDrawerSpecs } from "../core/drawers/DrawerParametrics";
import { calculateDrawerHeights } from "../core/drawers/DrawerGroup";
import {
  DRAWER_BODY_DELTA_LOWEST_MM,
  DRAWER_BODY_DELTA_UPPER_MM,
  DRAWER_BODY_ELEVATION_FROM_FRONT_MM,
  DRAWER_LOWEST_BODY_ELEVATION_FROM_FRONT_MM,
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
    expect(DRAWER_LOWEST_BODY_ELEVATION_FROM_FRONT_MM).toBe(16.5);
    expect(DRAWER_BODY_DELTA_LOWEST_MM).toBe(85.5);
    expect(DRAWER_BODY_DELTA_UPPER_MM).toBe(68.5);
    expect(DRAWER_COSTA_HEIGHT_BELOW_LATERAL_MM).toBe(23);
    expect(resolveDrawerBodyElevationForStackRoleMm("lowest")).toBe(16.5);
    expect(resolveDrawerBodyElevationForStackRoleMm("single")).toBe(16.5);
    expect(resolveDrawerBodyElevationForStackRoleMm("middle")).toBe(48);
    expect(resolveDrawerBodyElevationForStackRoleMm("highest")).toBe(48);
    expect(resolveDrawerBodyDeltaForStackRoleMm("lowest")).toBe(85.5);
    expect(resolveDrawerBodyDeltaForStackRoleMm("middle")).toBe(68.5);
  });

  it("laterais 176,5 / 195,5 / 195,5 e costas 153,5 / 172,5 / 172,5 (B0=2)", () => {
    const fronts = calculateDrawerHeights(3, 800, "equal");
    expect(fronts[0]).toBeCloseTo(262, 5);
    expect(fronts[1]).toBeCloseTo(264, 5);
    expect(fronts[2]).toBeCloseTo(264, 5);

    const s1 = calculateDrawerSpecs(baseDims(fronts[0]!, "lowest"), DEPTHS);
    const s2 = calculateDrawerSpecs(baseDims(fronts[1]!, "middle"), DEPTHS);
    const s3 = calculateDrawerSpecs(baseDims(fronts[2]!, "highest"), DEPTHS);

    expect(s1.leftSide.height).toBeCloseTo(176.5, 5);
    expect(s1.rightSide.height).toBeCloseTo(176.5, 5);
    expect(s1.back.height).toBeCloseTo(153.5, 5);
    expect(s1.sideBaseElevationMm).toBe(16.5);

    expect(s2.leftSide.height).toBeCloseTo(195.5, 5);
    expect(s2.back.height).toBeCloseTo(172.5, 5);
    expect(s2.sideBaseElevationMm).toBe(48);

    expect(s3.leftSide.height).toBeCloseTo(195.5, 5);
    expect(s3.back.height).toBeCloseTo(172.5, 5);
    expect(s3.sideBaseElevationMm).toBe(48);

    expect(s2.leftSide.height).toBeCloseTo(s3.leftSide.height, 5);
    expect(s2.back.height).toBeCloseTo(s3.back.height, 5);
  });

  it("furos frente GAV_1: Y = 70,5 e 158 com elev=16,5 (aresta 54)", () => {
    const sideH = 176.5;
    const elev = 16.5;
    const frontH = 262;
    const holes = computeDrawerFrenteExtStructuralHoles({
      largura: 592,
      altura: frontH,
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
    const cavInf = elev + 54;
    const cavSup = elev + sideH - 35;
    expect(Math.min(...type1Ys)).toBeCloseTo(cavInf, 5);
    expect(Math.max(...type1Ys.filter((y) => y < 250))).toBeCloseTo(cavSup, 5);
    expect(cavInf).toBeCloseTo(70.5, 5);
  });
});
