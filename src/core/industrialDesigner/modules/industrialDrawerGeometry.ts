/**
 * Geometria partilhada — módulos de gaveta industrial (caixa base + corpo de gaveta).
 */

import { settingsDefaults } from "../../settings/settingsSchema";
import {
  DRAWER_BOTTOM_DEFAULT_THICKNESS_MM,
  DRAWER_SIDE_THICKNESS_MM,
} from "../../materials/materials.api";
import {
  DRAWER_FRONT_LATERAL_GAP_MM,
  DRAWER_SIDE_BASE_ELEVATION_MM,
} from "../../drawers/drawerGeometryConstants";
import { createIndustrialDesignBox } from "../designModel";
import type { DesignPanel, IndustrialDesignBox } from "../types";

export const INDUSTRIAL_DRAWER_CABINET_ESP_MM = 19;
export const INDUSTRIAL_DRAWER_CABINET_BACK_MM = 10;
export const INDUSTRIAL_DRAWER_BACK_THICKNESS_MM = 16;
export const INDUSTRIAL_DRAWER_BODY_FRONT_CLEARANCE_MM = 50;

export type DrawerIndustrialOuter = {
  widthMm: number;
  heightMm: number;
  depthMm: number;
};

export type IndustrialDrawerSingleLayout = {
  outer: DrawerIndustrialOuter;
  espMm: number;
  backMm: number;
  innerW: number;
  innerH: number;
  innerD: number;
  frontExtW: number;
  frontExtH: number;
  frontExtT: number;
  frontIntW: number;
  frontIntH: number;
  frontIntT: number;
  sideDepthMm: number;
  sideHeightMm: number;
  sideThicknessMm: number;
  bottomW: number;
  bottomD: number;
  bottomT: number;
  backW: number;
  backH: number;
  backT: number;
  drawerFrontY: number;
  drawerBodyY: number;
  drawerZ: number;
};

export function computeIndustrialDrawerSingleLayout(
  outer: DrawerIndustrialOuter
): IndustrialDrawerSingleLayout {
  const espMm = INDUSTRIAL_DRAWER_CABINET_ESP_MM;
  const backMm = INDUSTRIAL_DRAWER_CABINET_BACK_MM;
  const innerW = outer.widthMm - 2 * espMm;
  const innerH = outer.heightMm - 2 * espMm;
  const innerD = outer.depthMm - backMm - espMm;

  const frontExtW = innerW - 2 * DRAWER_FRONT_LATERAL_GAP_MM;
  const frontExtH = innerH - 4 - 4;
  const frontExtT = espMm;
  const sideThicknessMm = DRAWER_SIDE_THICKNESS_MM;
  const frontIntW = frontExtW - 2 * sideThicknessMm;
  const heightFactor =
    1 - settingsDefaults.gavetas.gavetaReducaoPercentual / 100;
  const frontIntH = Math.round(frontExtH * heightFactor);
  const frontIntT = sideThicknessMm;
  const sideHeightMm = frontIntH;
  const sideDepthMm = Math.max(200, innerD - INDUSTRIAL_DRAWER_BODY_FRONT_CLEARANCE_MM);
  const backT = INDUSTRIAL_DRAWER_BACK_THICKNESS_MM;
  const bottomT = DRAWER_BOTTOM_DEFAULT_THICKNESS_MM;
  const bottomW = frontIntW;
  const bottomD = Math.max(150, sideDepthMm - backT);
  const backW = frontIntW;
  const backH = Math.max(1, Math.round(sideHeightMm * heightFactor));

  const drawerFrontY = espMm + 2;
  const drawerBodyY = drawerFrontY + DRAWER_SIDE_BASE_ELEVATION_MM;
  const drawerZ = backMm + 2;

  return {
    outer,
    espMm,
    backMm,
    innerW,
    innerH,
    innerD,
    frontExtW,
    frontExtH,
    frontExtT,
    frontIntW,
    frontIntH,
    frontIntT,
    sideDepthMm,
    sideHeightMm,
    sideThicknessMm,
    bottomW,
    bottomD,
    bottomT,
    backW,
    backH,
    backT,
    drawerFrontY,
    drawerBodyY,
    drawerZ,
  };
}

function makeDrawerPanel(
  boxId: string,
  tipo: DesignPanel["tipo"],
  suffix: string,
  widthMm: number,
  heightMm: number,
  thicknessMm: number,
  materialId: string,
  positionMm: DesignPanel["positionMm"]
): DesignPanel {
  return {
    id: `${boxId}:${suffix}`,
    tipo,
    widthMm,
    heightMm,
    thicknessMm,
    materialId,
    drillHoles: [],
    positionMm,
  };
}

export function buildIndustrialDrawerSinglePanels(
  boxId: string,
  layout: IndustrialDrawerSingleLayout,
  materialId: string
): DesignPanel[] {
  const { espMm, outer, drawerFrontY, drawerBodyY, drawerZ } = layout;
  const frontX = espMm + DRAWER_FRONT_LATERAL_GAP_MM;
  const bodyX = espMm + DRAWER_FRONT_LATERAL_GAP_MM + layout.sideThicknessMm;

  return [
    makeDrawerPanel(
      boxId,
      "gaveta_frente_ext",
      "gaveta-frente-ext",
      layout.frontExtW,
      layout.frontExtH,
      layout.frontExtT,
      materialId,
      { x: frontX, y: drawerFrontY, z: outer.depthMm - layout.frontExtT }
    ),
    makeDrawerPanel(
      boxId,
      "gaveta_frente_int",
      "gaveta-frente-int",
      layout.frontIntW,
      layout.frontIntH,
      layout.frontIntT,
      materialId,
      { x: bodyX, y: drawerBodyY, z: outer.depthMm - layout.frontExtT - layout.frontIntT }
    ),
    makeDrawerPanel(
      boxId,
      "gaveta_lat_esq",
      "gaveta-lat-esq",
      layout.sideDepthMm,
      layout.sideHeightMm,
      layout.sideThicknessMm,
      materialId,
      { x: bodyX - layout.sideThicknessMm, y: drawerBodyY, z: drawerZ }
    ),
    makeDrawerPanel(
      boxId,
      "gaveta_lat_dir",
      "gaveta-lat-dir",
      layout.sideDepthMm,
      layout.sideHeightMm,
      layout.sideThicknessMm,
      materialId,
      {
        x: bodyX + layout.frontIntW,
        y: drawerBodyY,
        z: drawerZ,
      }
    ),
    makeDrawerPanel(
      boxId,
      "gaveta_fundo",
      "gaveta-fundo",
      layout.bottomW,
      layout.bottomD,
      layout.bottomT,
      materialId,
      { x: bodyX, y: drawerBodyY, z: drawerZ }
    ),
    makeDrawerPanel(
      boxId,
      "gaveta_traseira",
      "gaveta-traseira",
      layout.backW,
      layout.backH,
      layout.backT,
      materialId,
      { x: bodyX, y: drawerBodyY, z: drawerZ + layout.sideDepthMm - layout.backT }
    ),
  ];
}

export function buildIndustrialDrawerSingleDesignBox(
  boxId: string,
  nome: string,
  outer: DrawerIndustrialOuter,
  materialId: string
): { box: IndustrialDesignBox; layout: IndustrialDrawerSingleLayout } {
  const layout = computeIndustrialDrawerSingleLayout(outer);
  let box = createIndustrialDesignBox({
    id: boxId,
    nome,
    outerWidthMm: outer.widthMm,
    outerHeightMm: outer.heightMm,
    outerDepthMm: outer.depthMm,
    espessuraMm: layout.espMm,
    materialId,
  });
  box = { ...box, designWorkspace: false };
  const drawerPanels = buildIndustrialDrawerSinglePanels(boxId, layout, materialId);
  box = { ...box, panels: [...box.panels, ...drawerPanels] };
  return { box, layout };
}
