/**
 * Posição da gaveta no stack vertical do módulo (SSOT industrial).
 *
 * Ordem física: índice 0 = inferior (perto da base); último = superior (perto da CIMA).
 * Com `DRAWER_VERTICAL_BASE_OFFSET_MM = 0` (Diff 3 / gavita 8):
 * - frente inferior flush à base do vão (B0 = 0)
 * - frente superior chega à borda superior (CIMA)
 * - modo `"equal"` = equal_quase (1.ª frente −2 mm)
 */

import {
  DRAWER_BODY_DELTA_LOWEST_MM,
  DRAWER_BODY_DELTA_UPPER_MM,
  DRAWER_BODY_ELEVATION_FROM_FRONT_MM,
  DRAWER_LOWEST_FRONT_BOTTOM_FROM_MODULE_BASE_MM,
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
 * Elevação do corpo vs base da frente (mm) — constante industrial 48 (gavita 8).
 * `boxFloorThicknessMm` mantido na assinatura por compatibilidade de callers.
 */
export function resolveLowestDrawerBodyElevationFromFrontMm(
  boxFloorThicknessMm: number = 19
): number {
  void boxFloorThicknessMm;
  return DRAWER_BODY_ELEVATION_FROM_FRONT_MM;
}

/**
 * Single alinhado ao modelo unificado (48 mm) — já não T+18,5.
 */
export function resolveSingleDrawerBodyElevationFromFrontMm(
  boxFloorThicknessMm: number = 19
): number {
  void boxFloorThicknessMm;
  return DRAWER_BODY_ELEVATION_FROM_FRONT_MM;
}

/**
 * Elevação industrial do corpo vs frente — todas as gavetas = 48 mm.
 */
export function resolveDrawerBodyElevationForStackRoleMm(
  stackRole: DrawerStackRole,
  boxFloorThicknessMm: number = 19
): number {
  void stackRole;
  void boxFloorThicknessMm;
  return DRAWER_BODY_ELEVATION_FROM_FRONT_MM;
}

/**
 * Delta frente − lateral por papel no stack (mm).
 * lowest/single: 85,5 · middle/highest: 68,5.
 */
export function resolveDrawerBodyDeltaForStackRoleMm(
  stackRole: DrawerStackRole
): number {
  switch (stackRole) {
    case "lowest":
    case "single":
      return DRAWER_BODY_DELTA_LOWEST_MM;
    case "highest":
    case "middle":
    default:
      return DRAWER_BODY_DELTA_UPPER_MM;
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
  /** Confirma flush — base (inferior / única). */
  flushToModuleBase: boolean;
  /** Confirma flush — CIMA (superior / única). */
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
  /** Flush industrial = base da frente no datum GAV_1 (B0=0). */
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
