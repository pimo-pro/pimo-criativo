import { describe, expect, it } from "vitest";
import { buildDrawerSpecs } from "../3d/objects/DrawerFactory";
import {
  assertDrawerWoodPiecesDisjoint,
  buildDrawerWoodViewerPieceBoxes,
  resolveDrawerBodyCenterOffsetYMm,
  resolveDrawerBodyCenterZMm,
  resolveDrawerFrontFlushLayoutMm,
  resolveDrawerGroupPosZMm,
  resolveDrawerViewerPosZAdjustmentMm,
} from "../core/drawers/drawerViewerLayout";
import { DRAWER_SIDE_BASE_ELEVATION_MM } from "../core/drawers/drawerGeometryConstants";
import { drawerGroupToLayerItems, generateDrawerGroup } from "../core/drawers";
import { settingsDefaults } from "../core/settings/settingsSchema";

describe("drawerViewerLayout — geometria 3D industrial", () => {
  it("frente 1 mm à frente da face externa (após ajuste carcaça)", () => {
    const carcass = 531;
    const layout = 560;
    const frontT = 19;
    const posZ = resolveDrawerGroupPosZMm(layout, frontT);
    const dz = resolveDrawerViewerPosZAdjustmentMm(layout, carcass);
    expect(posZ + dz + frontT / 2).toBeCloseTo(carcass / 2 + 1, 3);
  });

  it("resolveDrawerFrontFlushLayoutMm — frente overlay 1 mm à frente da carcaça (P_útil)", () => {
    // P_útil já desconta t: outer = P_útil/2 + t + 1; centro = outer − t/2
    // 521/2 + 19 + 1 = 280.5; center = 271; costas da frente = P_útil/2 + 1
    const layout = resolveDrawerFrontFlushLayoutMm(550, 521, 19, 21);
    expect(layout.frontOuterZ).toBe(280.5);
    expect(layout.frontPosZ).toBe(271);
    expect(layout.bodyCenterLocalZ).toBeCloseTo(-259.5, 3);
    expect(layout.frontPosZ + 19 / 2).toBe(layout.frontOuterZ);
    expect(layout.frontOuterZ - 19).toBeCloseTo(521 / 2 + 1, 3);
    expect(layout.frontOuterZ).toBeCloseTo(521 / 2 + 19 + 1, 3);
  });

  it("corpo Z = −(esp. frente + slideLength)/2", () => {
    expect(resolveDrawerBodyCenterZMm(19, 500)).toBeCloseTo(-(19 / 2 + 500 / 2), 3);
  });

  it("laterais elevadas — offset Y = −(H−H_body)/2 + elevação", () => {
    expect(resolveDrawerBodyCenterOffsetYMm(200)).toBe(-25 + DRAWER_SIDE_BASE_ELEVATION_MM);
  });

  it("layer → spec → posições coerentes com domínio", () => {
    const group = generateDrawerGroup({
      boxWidth: 600,
      boxHeight: 400,
      boxDepth: 560,
      boxThickness: 19,
      boxId: "viewer-layout",
      drawerCount: 1,
      drawerType: "normal",
      heightMode: "equal",
      availableDepths: settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      drawerSettings: settingsDefaults.gavetas,
    });
    const [layer] = drawerGroupToLayerItems(group);
    const [spec] = buildDrawerSpecs([layer]);

    expect(spec.frontPosZ).toBe(0);
    expect(spec.frontPosY).toBe(0);
    expect(spec.bodyDepthM).toBeCloseTo(0.5, 3);
    expect(spec.leftSideDepthM).toBeCloseTo(0.49, 3);
    expect(spec.leftSidePosZ).toBeCloseTo(resolveDrawerBodyCenterZMm(19, 490) / 1000, 4);
    expect(spec.leftSidePosY).toBeCloseTo(
      (layer.leftSidePosY ?? layer.bodyCenterOffsetY ?? 0) / 1000,
      4
    );
    expect(spec.heightM).toBeGreaterThan(spec.woodBodyHeightM ?? 0);
  });

  it("peças madeira — frente não intersecta laterais", () => {
    const boxes = buildDrawerWoodViewerPieceBoxes({
      frontWidthMm: 598,
      frontHeightMm: 390,
      frontThicknessMm: 19,
      bodyWidthMm: 548,
      slideLengthMm: 500,
      sideThicknessMm: 16,
      woodBodyHeightMm: 292.5,
      bottomThicknessMm: 10,
      backThicknessMm: 16,
      backWidthMm: 516,
    });
    const front = boxes.find((b) => b.name === "frente_ext")!;
    const latEsq = boxes.find((b) => b.name === "lat_esq")!;
    const latDir = boxes.find((b) => b.name === "lat_dir")!;
    expect(assertDrawerWoodPiecesDisjoint([front, latEsq])).toBeNull();
    expect(assertDrawerWoodPiecesDisjoint([front, latDir])).toBeNull();
    expect(front.minY - latEsq.minY).toBeCloseTo(-DRAWER_SIDE_BASE_ELEVATION_MM, 0);
    expect(front.maxZ - latEsq.maxZ).toBeGreaterThan(0);
  });

  it("factor único: laterais = frente × f; costa = laterais × f", () => {
    const group = generateDrawerGroup({
      boxWidth: 600,
      boxHeight: 400,
      boxDepth: 560,
      boxThickness: 19,
      boxId: "viewer-delta",
      drawerCount: 1,
      drawerType: "normal",
      heightMode: "equal",
      availableDepths: settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      drawerSettings: settingsDefaults.gavetas,
    });
    const [layer] = drawerGroupToLayerItems(group);
    const f = 1 - settingsDefaults.gavetas.gavetaReducaoPercentual / 100;
    const sideH = layer.leftSideHeight ?? layer.bodyHeight ?? 0;
    expect(sideH).toBeCloseTo((layer.height ?? 0) * f, 1);
    expect(layer.backHeight ?? 0).toBeCloseTo(sideH * f, 1);
  });
});
