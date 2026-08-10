import { describe, expect, it } from "vitest";
import { DRAWER_SIDE_BASE_ELEVATION_MM, DRAWER_SIDE_TOP_CLEARANCE_RATIO } from "../core/drawers/drawerGeometryConstants";
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
import {
  resolveDrawerVerticalPositions,
} from "../core/drawers/drawerVerticalPosition";
import { resolveDrawerBodyHeightMm } from "../core/drawers/drawerLayerCustomization";
import { settingsDefaults } from "../core/settings/settingsSchema";
import type { DrawerLayerItem } from "../models/BoxLayers";

describe("altura do corpo da gaveta (frente × 75%)", () => {
  it("H_body = H_front × 0,75", () => {
    expect(resolveDrawerWoodBodyHeightMm(200)).toBe(150);
    expect(resolveDrawerWoodBodyHeightMm(180)).toBe(135);
  });

  it("calculateDrawerSpecs aplica ratio nas laterais e costa", () => {
    const specs = calculateDrawerSpecs(
      {
        boxInternalWidth: 562,
        boxExternalWidth: 600,
        boxInternalHeight: 710,
        boxInternalDepth: 500,
        boxThickness: 19,
        drawerHeight: 200,
        totalDrawers: 1,
        type: "normal",
      },
      settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      settingsDefaults.gavetas
    );
    expect(specs.frontExt.height).toBe(200);
    expect(specs.body.height).toBe(150);
    expect(specs.back.height).toBeCloseTo(150 * settingsDefaults.gavetas.gavetaPercentualReducaoCosta, 5);
    expect(specs.leftSide.height).toBe(150);
  });

  it("bounding boxes madeira — frente mais alta que laterais, bases alinhadas", () => {
    const woodH = 150;
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
    expect(front.maxY - lat.maxY).toBeCloseTo(
      200 * DRAWER_SIDE_TOP_CLEARANCE_RATIO - DRAWER_SIDE_BASE_ELEVATION_MM,
      0
    );
  });

  it("offset Y do corpo = −(H_front − H_body)/2 + elevação", () => {
    expect(resolveDrawerBodyCenterOffsetYMm(200)).toBe(-25 + DRAWER_SIDE_BASE_ELEVATION_MM);
  });

  it("laterais — base elevada, altura 75%%, topo proporcional", () => {
    const frontH = 200;
    const sideH = resolveDrawerViewerSideHeightMm(frontH);
    const sideY = resolveDrawerViewerSidePosYMm(0, frontH, sideH);
    const sideTop = sideY + sideH / 2;
    const sideBottom = sideY - sideH / 2;
    expect(sideH).toBe(150);
    expect(sideBottom).toBeCloseTo(-100 + DRAWER_SIDE_BASE_ELEVATION_MM, 3);
    expect(sideTop).toBeCloseTo(sideBottom + sideH, 3);
    expect(frontH / 2 - sideTop).toBeCloseTo(
      frontH * DRAWER_SIDE_TOP_CLEARANCE_RATIO - DRAWER_SIDE_BASE_ELEVATION_MM,
      3
    );
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

  it("generateDrawerGroup — posições Y para 3 gavetas iguais", () => {
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
  });
});
