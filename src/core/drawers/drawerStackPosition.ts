/**
 * Posição da gaveta no stack vertical do módulo (SSOT industrial).
 *
 * Ordem física: índice 0 = inferior (perto da base); último = superior (perto da CIMA).
 * Com `DRAWER_VERTICAL_BASE_OFFSET_MM = 2` (GAV_1):
 * - frente inferior a 2 mm acima da base do vão
 * - frente superior chega — borda superior (CIMA)
 */

import {
  DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM,
  DRAWER_LOWEST_FRONT_BOTTOM_FROM_MODULE_BASE_MM,
  DRAWER_SIDE_BASE_ELEVATION_MM,
  DRAWER_SINGLE_BODY_CLEARANCE_ABOVE_FLOOR_MM,
} from "./drawerGeometryConstants";

export type DrawerStackRole = "lowest" | "highest" | "middle" | "single";

export function resolveDrawerStackRole(
  drawerIndex0Based: number,
  drawerCount: number
): DrawerStackRole {
  const n = Math.max(0, Math.floor(drawerCount));
  const i = Math.max(0, Math.floor(drawerIndex0Based));
  if (n <= 1) return "single";
  if (i <= 0) return "lowest";
  if (i >= n - 1) return "highest";
  return "middle";
}

/**
 * Elevação do corpo vs base da frente (mm) — gaveta inferior (GAV_1 / role=lowest).
 * E_inf_real = 16,5 mm absoluto (independente de T_fundo).
 * `boxFloorThicknessMm` mantido na assinatura por compatibilidade de callers.
 */
export function resolveLowestDrawerBodyElevationFromFrontMm(
  boxFloorThicknessMm: number = 19
): number {
  void boxFloorThicknessMm;
  return DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM;
}

/**
 * Elevação legado — gaveta única (role=single): T_fundo + 18,5.
 * Mantida até aprovação industrial da regra GAV_1 para single.
 */
export function resolveSingleDrawerBodyElevationFromFrontMm(
  boxFloorThicknessMm: number = 19
): number {
  const T = Math.max(0, Number(boxFloorThicknessMm) || 0);
  return T + DRAWER_SINGLE_BODY_CLEARANCE_ABOVE_FLOOR_MM;
}

/**
 * Elevação industrial do corpo vs frente por papel no stack.
 * lowest (GAV_1): 16,5 absoluto · single: T+18,5 (legado) · middle/highest: 17.
 *
 * middle e highest usam o mesmo valor (antes: 17 / 12,5) para intercambiabilidade.
 * DRAWER_HIGHEST_BODY_ELEVATION_FROM_FRONT_MM (12,5) é só referência legada.
 */
export function resolveDrawerBodyElevationForStackRoleMm(
  stackRole: DrawerStackRole,
  boxFloorThicknessMm: number = 19
): number {
  switch (stackRole) {
    case "lowest":
      return resolveLowestDrawerBodyElevationFromFrontMm(boxFloorThicknessMm);
    case "single":
      return resolveSingleDrawerBodyElevationFromFrontMm(boxFloorThicknessMm);
    case "highest":
    case "middle":
    default:
      return DRAWER_SIDE_BASE_ELEVATION_MM;
  }
}

/** Base do corpo relativamente — base do módulo (mm). */
export function resolveDrawerBodyBottomFromModuleBaseMm(params: {
  frontBottomFromModuleBaseMm: number;
  sideBaseElevationMm: number;
}): number {
  return params.frontBottomFromModuleBaseMm + params.sideBaseElevationMm;
}

export type DrawerFrontStackGeometry = {
  role: DrawerStackRole;
  /** Altura da frente (mm) — igual ao slot atribuído em calculateDrawerHeights. */
  frontHeightMm: number;
  /** Distância da base da frente ao piso interno do vão (mm). */
  frontBottomFromModuleBaseMm: number;
  /** Distância do topo da frente ao piso interno (mm). */
  frontTopFromModuleBaseMm: number;
  /** Centro Y local (origem = centro do módulo). */
  posYMm: number;
  /** Confirma flush — base (inferior / úúnica). */
  flushToModuleBase: boolean;
  /** Confirma flush — CIMA (superior / úúnica). */
  flushToModuleTop: boolean;
};

/**
 * Geometria absoluta da frente no vão interno do módulo.
 * `drawerHeights` na mesma ordem que `calculateDrawerHeights` / `resolveDrawerVerticalPositions`.
 */
export function resolveDrawerFrontStackGeometry(params: {
  drawerIndex0Based: number;
  drawerHeights: number[];
  boxInternalHeightMm: number;
  baseOffsetMm?: number;
  posYMm: number;
}): DrawerFrontStackGeometry {
  const boxH = Math.max(1, Number(params.boxInternalHeightMm) || 1);
  const heights = params.drawerHeights;
  const i = Math.max(0, Math.min(heights.length - 1, params.drawerIndex0Based));
  const frontHeightMm = Math.max(1, Number(heights[i]) || 1);
  const role = resolveDrawerStackRole(i, heights.length);

  // Bottom a partir de posY (SSOT) — cobre stack equal clássico e bottoms SolidWorks.
  const frontBottomFromModuleBaseMm =
    params.posYMm - (-boxH / 2) - frontHeightMm / 2;
  const frontTopFromModuleBaseMm = frontBottomFromModuleBaseMm + frontHeightMm;

  const eps = 0.51;
  const industrialBaseMm =
    params.baseOffsetMm != null && Number.isFinite(params.baseOffsetMm)
      ? Number(params.baseOffsetMm)
      : DRAWER_LOWEST_FRONT_BOTTOM_FROM_MODULE_BASE_MM;
  /** Flush industrial = base da frente no datum GAV_1 (B0=2), não no zero geométrico. */
  const flushToModuleBase =
    (role === "lowest" || role === "single") &&
    Math.abs(frontBottomFromModuleBaseMm - industrialBaseMm) <= eps;
  const flushToModuleTop =
    (role === "highest" || role === "single") &&
    Math.abs(frontTopFromModuleBaseMm - boxH) <= eps;

  return {
    role,
    frontHeightMm,
    frontBottomFromModuleBaseMm,
    frontTopFromModuleBaseMm,
    posYMm: params.posYMm,
    flushToModuleBase,
    flushToModuleTop,
  };
}
