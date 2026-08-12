/**
 * Frente da gaveta — pairing 10–30 laterais ? 10–13 frente (CAVILHA_10x40).
 */
import { describe, expect, it } from "vitest";
import {
  computeDrawerFrenteExtStructuralHoles,
  computeDrawerLateralStructuralHoles,
  projectDrawerLateralEdgeCavilhasOntoFront,
} from "../core/drawers/drilling/DrawerDrillingRules";
import { computeDrawerLowestFrenteExtFixedHoles } from "../core/drawers/drilling/drawerLowestFrenteExtFixedHoles.legacy";
import {
  DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM,
  DRAWER_LOWEST_FRONT_DOWEL_X_INSET_MM,
  DRAWER_LOWEST_FRONT_GROOVE_FROM_TOP_MM,
  DRAWER_LOWEST_FRONT_GROOVE_X_INSET_MM,
  DRAWER_SIDE_BASE_ELEVATION_MM,
} from "../core/drawers/drawerGeometryConstants";
import {
  getDrawerLateralEdgeDowelYPositionsMm,
} from "../core/drawers/drilling/drawerDowelInterlock";
import { resolveDrawerWoodBodyHeightMm } from "../core/drawers/drawerViewerLayout";
import {
  CAVILHA_10x40_FERRAGEM_ID,
  CAVILHA_FACE_DEPTH_MM,
} from "../core/drill/cavilha10x40Rule";

describe("gav_frente_ext — pairing com laterais (regra global)", () => {
  it("constantes rasgo golden + X inset", () => {
    expect(DRAWER_LOWEST_FRONT_GROOVE_FROM_TOP_MM).toBe(56.5);
    expect(DRAWER_LOWEST_FRONT_GROOVE_X_INSET_MM).toBe(12);
    expect(DRAWER_LOWEST_FRONT_DOWEL_X_INSET_MM).toBe(33);
    expect(DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM).toBe(16.5);
  });

  it("lowest: exactamente 4 cavilhas = elev+Y_aresta laterais (sem W?73.5 duplicado)", () => {
    const L = 798;
    const W = 260.67;
    const sideH = 195.5;
    const elev = DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM;
    const holes = computeDrawerLowestFrenteExtFixedHoles({
      largura: L,
      altura: W,
      espessura: 19,
      bottomThicknessMm: 10,
      sideHeightMm: sideH,
      sideBaseElevationMm: elev,
      bodyWidthMm: L - 50,
      sideThicknessMm: 16,
    });
    const cav = holes.filter((h) => h.tipo === "cavilha");
    const edgeYs = getDrawerLateralEdgeDowelYPositionsMm(sideH);
    expect(edgeYs).toEqual([15, sideH - 35]);
    expect(cav).toHaveLength(4);

    const expectedYs = edgeYs.map((y) => elev + y);
    for (const y of expectedYs) {
      expect(cav.filter((h) => Math.abs(h.y - y) < 0.01)).toHaveLength(2);
    }
    // Não duplicar perto de W?73.5 se ? pairing
    const legacyY = W - 73.5;
    if (expectedYs.every((y) => Math.abs(y - legacyY) > 2)) {
      expect(cav.every((h) => Math.abs(h.y - legacyY) > 0.5)).toBe(true);
    }
    expect(cav.every((h) => h.profundidade === CAVILHA_FACE_DEPTH_MM)).toBe(true);
    expect(cav.every((h) => h.ferragemId === CAVILHA_10x40_FERRAGEM_ID)).toBe(true);
    expect(cav.every((h) => h.x === 33 || h.x === L - 33)).toBe(true);

    const groove = holes.find((h) => h.holeSubtype === "groove")!;
    expect(groove.y).toBeCloseTo(W - 56.5, 5);
    expect(groove.x).toBe(12);
  });

  it("highest: mesmos Y = elev + aresta laterais", () => {
    const frontH = 358;
    const sideH = resolveDrawerWoodBodyHeightMm(frontH);
    const elev = DRAWER_SIDE_BASE_ELEVATION_MM;
    const holes = computeDrawerFrenteExtStructuralHoles({
      largura: 598,
      altura: frontH,
      espessura: 19,
      stackRole: "highest",
      isLowestDrawer: false,
      sideHeightMm: sideH,
      bodyWidthMm: 548,
      sideThicknessMm: 16,
      bottomThicknessMm: 10,
      sideBaseElevationMm: elev,
    });
    const cav = holes.filter((h) => h.tipo === "cavilha");
    const edgeYs = getDrawerLateralEdgeDowelYPositionsMm(sideH);
    expect(cav).toHaveLength(4);
    for (const yLat of edgeYs) {
      expect(cav.filter((h) => Math.abs(h.y - (elev + yLat)) < 0.01)).toHaveLength(2);
    }
  });

  it("Y frente coincide com Y aresta laterais (esq/dir)", () => {
    const sideH = 195.5;
    const elev = 18.5;
    const lat = computeDrawerLateralStructuralHoles({
      largura: 540,
      altura: sideH,
      espessura: 16,
      side: "esq",
    });
    const latEdgeYs = lat
      .filter((h) => h.tipo === "cavilha" && !h.topDrillable)
      .map((h) => h.y)
      .sort((a, b) => a - b);
    const front = projectDrawerLateralEdgeCavilhasOntoFront({
      frontWidthMm: 798,
      frontHeightMm: 260.67,
      espessuraMm: 19,
      sideHeightMm: sideH,
      sideBaseElevationMm: elev,
      bodyWidthMm: 748,
      sideThicknessMm: 16,
    });
    const frontYs = [...new Set(front.map((h) => h.y))].sort((a, b) => a - b);
    expect(frontYs).toEqual(latEdgeYs.map((y) => y + elev));
  });
});
