import { describe, expect, it } from "vitest";
import { computeDrawerFrenteExtStructuralHoles } from "./DrawerDrillingRules";
import {
  DRAWER_SIDE_BASE_ELEVATION_MM,
  resolveDrawerBottomWidthFromBodyMm,
} from "../drawerGeometryConstants";

describe("Fase D — rasgo frente alinhado ao SSOT gav_fundo", () => {
  it("rasgo usa bottomWidth explícito quando fornecido", () => {
    const holes = computeDrawerFrenteExtStructuralHoles({
      largura: 598,
      altura: 200,
      espessura: 19,
      sideHeightMm: 150,
      bodyWidthMm: 548,
      sideThicknessMm: 16,
      bottomThicknessMm: 10,
      sideBaseElevationMm: DRAWER_SIDE_BASE_ELEVATION_MM,
      bottomWidthMm: 534,
    });
    const groove = holes.find((h) => h.holeSubtype === "groove");
    expect(groove).toBeDefined();
    expect(groove!.grooveLength).toBe(534);
    expect(groove!.x).toBeCloseTo((598 - 534) / 2, 5);
  });

  it("fallback = fórmula SSOT (= vão + 2×entrada)", () => {
    const bodyWidthMm = 548;
    const sideThicknessMm = 16;
    const expected = resolveDrawerBottomWidthFromBodyMm(bodyWidthMm, sideThicknessMm);
    expect(expected).toBe(534); // 548 − 2×(16−9) = 534

    const holes = computeDrawerFrenteExtStructuralHoles({
      largura: 598,
      altura: 200,
      espessura: 19,
      sideHeightMm: 150,
      bodyWidthMm,
      sideThicknessMm,
      bottomThicknessMm: 10,
      sideBaseElevationMm: DRAWER_SIDE_BASE_ELEVATION_MM,
    });
    const groove = holes.find((h) => h.holeSubtype === "groove");
    expect(groove!.grooveLength).toBe(534);
    expect(groove!.x).toBeCloseTo((598 - 534) / 2, 5);
  });
});
