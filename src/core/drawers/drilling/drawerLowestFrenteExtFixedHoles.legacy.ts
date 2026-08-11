/**
 * P3.15 — LEGADO / GOLDEN ONLY
 *
 * Furação da frente inferior com rasgo W−56.5 / X=12 (XML_COMPLITO).
 * Produção usa exclusivamente `computeDrawerFrenteExtStructuralHoles`
 * (padrão uniforme 01/02/03: elev + sideH − 13).
 *
 * Não importar em cutlist / drillingService / drillExport.
 */

import type { TechnicalDrillHole } from "../../types";
import {
  DRAWER_BOTTOM_GROOVE_WIDTH_MM,
  DRAWER_FRONT_BOTTOM_GROOVE_DEPTH_MM,
  DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM,
  DRAWER_LOWEST_FRONT_DOWEL_X_INSET_MM,
  DRAWER_LOWEST_FRONT_GROOVE_FROM_TOP_MM,
  DRAWER_LOWEST_FRONT_GROOVE_X_INSET_MM,
} from "../drawerGeometryConstants";
import { projectDrawerLateralEdgeCavilhasOntoFront } from "./DrawerDrillingRules";

/**
 * @deprecated P3.12/P3.15 — rasgo fixo 53 mm na lowest removido da produção.
 * Mantido só para regressão golden.
 */
export const DRAWER_LOWEST_FRONT_BOTTOM_GROOVE_FROM_BASE_MM = 53;

/**
 * Frente inferior — legado XML_COMPLITO (rasgo W−56.5 / X=12).
 * @deprecated Usar `computeDrawerFrenteExtStructuralHoles` em produção.
 */
export function computeDrawerLowestFrenteExtFixedHoles(params: {
  largura: number;
  altura: number;
  espessura: number;
  bottomThicknessMm: number;
  sideHeightMm?: number;
  sideBaseElevationMm?: number;
  bodyWidthMm?: number;
  sideThicknessMm?: number;
}): TechnicalDrillHole[] {
  const { largura, altura, espessura, bottomThicknessMm } = params;
  const sideH = params.sideHeightMm ?? 0;
  const elev =
    params.sideBaseElevationMm != null && Number.isFinite(params.sideBaseElevationMm)
      ? params.sideBaseElevationMm
      : DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM;

  const holes =
    sideH > 0
      ? projectDrawerLateralEdgeCavilhasOntoFront({
          frontWidthMm: largura,
          frontHeightMm: altura,
          espessuraMm: espessura,
          sideHeightMm: sideH,
          sideBaseElevationMm: elev,
          bodyWidthMm: params.bodyWidthMm,
          sideThicknessMm: params.sideThicknessMm,
          xInsetMm: DRAWER_LOWEST_FRONT_DOWEL_X_INSET_MM,
        })
      : [];

  const xGroove = DRAWER_LOWEST_FRONT_GROOVE_X_INSET_MM;
  const yGroove = altura - DRAWER_LOWEST_FRONT_GROOVE_FROM_TOP_MM;
  const bottomT = Number(bottomThicknessMm);
  if (
    Number.isFinite(bottomT) &&
    bottomT > 0 &&
    yGroove > 0 &&
    yGroove < altura &&
    xGroove >= 0 &&
    largura > 2 * xGroove
  ) {
    holes.push({
      x: xGroove,
      y: yGroove,
      diametro: 0,
      profundidade: DRAWER_FRONT_BOTTOM_GROOVE_DEPTH_MM,
      tipo: "furacao_estrutural",
      face: "tras",
      holeSubtype: "groove",
      grooveWidth: DRAWER_BOTTOM_GROOVE_WIDTH_MM,
      grooveLength: largura - 2 * xGroove,
    });
  }

  return holes;
}
