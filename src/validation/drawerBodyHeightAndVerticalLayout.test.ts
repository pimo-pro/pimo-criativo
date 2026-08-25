/**
 * Diff 2 — altura do corpo: frente − delta(role); costa = lateral − 23; elev = 48.
 */
import { describe, expect, it } from "vitest";
import {
  DRAWER_BODY_DELTA_LOWEST_MM,
  DRAWER_BODY_DELTA_UPPER_MM,
  DRAWER_COSTA_HEIGHT_BELOW_LATERAL_MM,
  DRAWER_SIDE_BASE_ELEVATION_MM,
} from "../core/drawers/drawerGeometryConstants";
import { calculateDrawerSpecs } from "../core/drawers/DrawerParametrics";
import {
  calculateDrawerHeights,
  calculateDrawerPositions,
  generateDrawerGroup,
  drawerGroupToLayerItems,
} from "../core/drawers";
import {
  resolveDrawerWoodBodyHeightMm,
  resolveDrawerBodyCenterOffsetYMm,
  resolveDrawerViewerSideHeightMm,
  resolveDrawerViewerSidePosYMm,
  buildDrawerWoodViewerPieceBoxes,
} from "../core/drawers/drawerViewerLayout";
import { resolveDrawerBodyHeightMm } from "../core/drawers/drawerLayerCustomization";
import { resolveDrawerBodyDeltaForStackRoleMm } from "../core/drawers/drawerStackPosition";
import { settingsDefaults } from "../core/settings/settingsSchema";
import type { DrawerLayerItem } from "../models/BoxLayers";

describe("altura do corpo da gaveta (delta industrial)", () => {
  it("H_body = H_front − delta(role)", () => {
    // default role = middle → delta 68.5
    expect(resolveDrawerWoodBodyHeightMm(200)).toBeCloseTo(200 - 68.5, 5);
    expect(resolveDrawerWoodBodyHeightMm(180, "lowest")).toBeCloseTo(180 - 85.5, 5);
    expect(resolveDrawerWoodBodyHeightMm(180, "middle")).toBeCloseTo(180 - 68.5, 5);
  });

  it("calculateDrawerSpecs aplica delta nas laterais e costa−23", () => {
    const specs = calculateDrawerSpecs(
      {
        boxInternalWidth: 562,
        boxExternalWidth: 600,
        boxInternalHeight: 710,
        boxInternalDepth: 500,
        boxThickness: 19,
        drawerHeight: 200,
        totalDrawers: 1,
        stackRole: "single",
        type: "normal",
      },
      settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      settingsDefaults.gavetas
    );
    const lat = 200 - DRAWER_BODY_DELTA_LOWEST_MM; // single = lowest delta
    expect(specs.frontExt.height).toBe(200);
    expect(specs.body.height).toBeCloseTo(lat, 5);
    expect(specs.back.height).toBeCloseTo(lat - DRAWER_COSTA_HEIGHT_BELOW_LATERAL_MM, 5);
    expect(specs.leftSide.height).toBeCloseTo(lat, 5);
    expect(specs.sideBaseElevationMm).toBe(16.5);
  });

  it("bounding boxes madeira — frente mais alta que laterais, base elevada 48", () => {
    const woodH = 200 - DRAWER_BODY_DELTA_UPPER_MM;
    const boxes = buildDrawerWoodViewerPieceBoxes({
      frontWidthMm: 598,
      frontHeightMm: 200,
      frontThicknessMm: 19,
      bodyWidthMm: 548,
      slideLengthMm: 450,
      sideThicknessMm: 16,
      woodBodyHeightMm: woodH,
      bottomThicknessMm: 10,
      backThicknessMm: 16,
      backWidthMm: 516,
    });
    const front = boxes.find((b) => b.name === "frente_ext")!;
    const lat = boxes.find((b) => b.name === "lat_esq")!;
    expect(front.maxY - front.minY).toBe(200);
    expect(lat.maxY - lat.minY).toBe(woodH);
    expect(front.maxY - front.minY).toBeGreaterThan(lat.maxY - lat.minY);
    expect(lat.minY - front.minY).toBeCloseTo(DRAWER_SIDE_BASE_ELEVATION_MM, 0);
  });

  it("offset Y do corpo = −(H_front − H_body)/2 + elevação 48", () => {
    const bodyH = 200 - DRAWER_BODY_DELTA_UPPER_MM;
    expect(resolveDrawerBodyCenterOffsetYMm(200, bodyH)).toBeCloseTo(
      -(200 - bodyH) / 2 + DRAWER_SIDE_BASE_ELEVATION_MM,
      5
    );
  });

  it("laterais — base elevada 48, altura = frente − delta", () => {
    const frontH = 200;
    const sideH = resolveDrawerViewerSideHeightMm(frontH);
    const sideY = resolveDrawerViewerSidePosYMm(0, frontH, sideH);
    const sideTop = sideY + sideH / 2;
    const sideBottom = sideY - sideH / 2;
    expect(sideH).toBeCloseTo(frontH - DRAWER_BODY_DELTA_UPPER_MM, 5);
    expect(sideBottom).toBeCloseTo(-100 + DRAWER_SIDE_BASE_ELEVATION_MM, 3);
    expect(sideTop).toBeCloseTo(sideBottom + sideH, 3);
  });
});

describe("posição vertical — ordem do utilizador preservada", () => {
  const boxH = 720;

  it("modo progressivo: índice 0 = inferior (maior), último = superior (menor)", () => {
    const heights = calculateDrawerHeights(3, boxH, "top_small_mid_medium_bottom_large");
    expect(heights[0]).toBeGreaterThan(heights[2]!);
    const positions = calculateDrawerPositions(heights, boxH);
    expect(positions[0]).toBeLessThan(positions[2]!);
  });

  it("generateDrawerGroup — posições Y e bodyH = frente − delta", () => {
    const group = generateDrawerGroup({
      boxWidth: 600,
      boxHeight: boxH,
      boxDepth: 560,
      boxThickness: 19,
      boxId: "y-layout",
      drawerCount: 3,
      drawerType: "normal",
      heightMode: "equal",
      availableDepths: settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      drawerSettings: settingsDefaults.gavetas,
      espessuraCostaMm: 10,
      costaAtiva: true,
    });
    const layers = drawerGroupToLayerItems(group);
    const ys = layers.map((l) => l.posY!);
    expect(ys[0]).toBeLessThan(ys[1]!);
    expect(ys[1]).toBeLessThan(ys[2]!);
    expect(layers[0]!.height).toBeLessThan(boxH);
    layers.forEach((layer, i) => {
      const role = i === 0 ? "lowest" : i === layers.length - 1 ? "highest" : "middle";
      const delta = resolveDrawerBodyDeltaForStackRoleMm(role);
      expect(layer.bodyHeight).toBeCloseTo((layer.height ?? 0) - delta, 5);
      expect(resolveDrawerBodyHeightMm(layer as DrawerLayerItem)).toBeCloseTo(
        layer.bodyHeight!,
        5
      );
      // Caminho clássico exterior (generateDrawerGroup default): elev GAV_1 = 16,5 + T.
      const expectedElev = role === "lowest" ? 35.5 : 48;
      expect(layer.metadata?.sideBaseElevationMm).toBe(expectedElev);
    });
  });
});
