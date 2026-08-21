/**
 * Posição da gaveta no stack vertical do módulo (SSOT industrial).
 *
 * Ordem física: índice 0 = inferior (perto da base); último = superior (perto da CIMA).
 * GAV_1: bodyBottom ABSOLUTO = 18,5 mm (SSOT). Elevação frente↔corpo 16,5 é derivada.
 * B0 = 2 mm só na frente. Middle/highest: elevação 48 mm.
 * Modo `"equal"` = equal_quase (1.ª frente −2 mm de altura).
 */

import {
  DRAWER_BODY_DELTA_LOWEST_MM,
  DRAWER_BODY_DELTA_UPPER_MM,
  DRAWER_BODY_ELEVATION_FROM_FRONT_MM,
  DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM,
  DRAWER_LOWEST_BODY_ELEVATION_FROM_FRONT_MM,
  DRAWER_LOWEST_FRONT_BOTTOM_FROM_MODULE_BASE_MM,
  assertGav1IndustrialSsotOrThrow,
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

/** bodyBottom GAV_1 / single — SSOT absoluto 18,5 mm (ignora overrides). */
export function resolveGav1BodyBottomFromModuleBaseMm(): number {
  assertGav1IndustrialSsotOrThrow();
  return DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM;
}

/**
 * Elevação corpo vs frente GAV_1 — DERIVADA de bodyBottom − frontBottom.
 * Não é base SSOT; bodyBottom absoluto é 18,5 (desde floorTop).
 * Com frente em floorTop+B0 → 16,5.
 */
export function resolveLowestDrawerBodyElevationFromFrontMm(
  boxFloorThicknessMm: number = 19
): number {
  void boxFloorThicknessMm;
  assertGav1IndustrialSsotOrThrow();
  return DRAWER_LOWEST_BODY_ELEVATION_FROM_FRONT_MM;
}

/**
 * Clássico com frente na base exterior (+B0): elevação compensada para
 * bodyBottom permanecer floorTop + 18,5.
 * elev = 18,5 − (B0 − T) = 16,5 + T
 */
export function resolveClassicExteriorLowestBodyElevationFromFrontMm(
  boxFloorThicknessMm: number
): number {
  assertGav1IndustrialSsotOrThrow();
  const T = Math.max(1, Number(boxFloorThicknessMm) || 19);
  const frontBottomFromFloorTopMm =
    DRAWER_LOWEST_FRONT_BOTTOM_FROM_MODULE_BASE_MM - T;
  return DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM - frontBottomFromFloorTopMm;
}

/**
 * Single — mesma elevação derivada que GAV_1.
 */
export function resolveSingleDrawerBodyElevationFromFrontMm(
  boxFloorThicknessMm: number = 19
): number {
  void boxFloorThicknessMm;
  return resolveLowestDrawerBodyElevationFromFrontMm();
}

/**
 * Elevação industrial do corpo vs frente por papel no stack.
 * lowest / single → derivada do bodyBottom 18,5 (=16,5 com frente em floorTop+B0)
 * · classicExteriorFrontStack → elevação compensada (corpo ainda floorTop+18,5)
 * · middle / highest → 48.
 * Overrides de elevação GAV_1 são ignorados (sempre SSOT) excepto via Generation.
 */
export function resolveDrawerBodyElevationForStackRoleMm(
  stackRole: DrawerStackRole,
  boxFloorThicknessMm: number = 19,
  options?: { classicExteriorFrontStack?: boolean }
): number {
  switch (stackRole) {
    case "lowest":
    case "single":
      if (options?.classicExteriorFrontStack === true) {
        return resolveClassicExteriorLowestBodyElevationFromFrontMm(
          boxFloorThicknessMm
        );
      }
      return resolveLowestDrawerBodyElevationFromFrontMm();
    case "highest":
    case "middle":
    default:
      void boxFloorThicknessMm;
      return DRAWER_BODY_ELEVATION_FROM_FRONT_MM;
  }
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

/**
 * Base do corpo relativamente à base do módulo (mm).
 * GAV_1/single: SEMPRE 18,5 (SSOT absoluto) — frontBottom e elevação não alteram o resultado.
 */
export function resolveDrawerBodyBottomFromModuleBaseMm(params: {
  frontBottomFromModuleBaseMm: number;
  sideBaseElevationMm: number;
  stackRole?: DrawerStackRole;
}): number {
  if (params.stackRole === "lowest" || params.stackRole === "single") {
    return resolveGav1BodyBottomFromModuleBaseMm();
  }
  // Heurística: elevação ≈16,5 → tratar como GAV_1 mesmo sem role
  if (
    Math.abs(
      Number(params.sideBaseElevationMm) - DRAWER_LOWEST_BODY_ELEVATION_FROM_FRONT_MM
    ) <= 0.05
  ) {
    return resolveGav1BodyBottomFromModuleBaseMm();
  }
  void DRAWER_LOWEST_FRONT_BOTTOM_FROM_MODULE_BASE_MM;
  return params.frontBottomFromModuleBaseMm + params.sideBaseElevationMm;
}

export type DrawerFrontStackGeometry = {
  role: DrawerStackRole;
  /** Altura da frente (mm) — igual ao slot atribuído em calculateDrawerHeights. */
  frontHeightMm: number;
  /**
 * Distância da base da frente ao piso interno do vão (face superior do fundo) (mm).
 */
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
 * Datum: face superior do fundo (`floorThicknessMm`); com T=0 = legado face inferior externa.
 * `drawerHeights` na mesma ordem que `calculateDrawerHeights` / `resolveDrawerVerticalPositions`.
 */
export function resolveDrawerFrontStackGeometry(params: {
  drawerIndex0Based: number;
  drawerHeights: number[];
  boxInternalHeightMm: number;
  baseOffsetMm?: number;
  posYMm: number;
  /** Espessura do fundo (mm). Com T>0, frontBottom é relativo ao topo do fundo. */
  floorThicknessMm?: number;
  topPanelThicknessMm?: number;
}): DrawerFrontStackGeometry {
  const boxH = Math.max(1, Number(params.boxInternalHeightMm) || 1);
  const heights = params.drawerHeights;
  const i = Math.max(0, Math.min(heights.length - 1, params.drawerIndex0Based));
  const frontHeightMm = Math.max(1, Number(heights[i]) || 1);
  const role = resolveDrawerStackRole(i, heights.length);
  const floorT = Math.max(0, Number(params.floorThicknessMm) || 0);
  const topT = Math.max(0, Number(params.topPanelThicknessMm) || floorT);
  const floorTopY = -boxH / 2 + floorT;

  // Bottom a partir de posY (SSOT) — relativo à face superior do fundo quando T>0.
  const frontBottomFromModuleBaseMm =
    params.posYMm - floorTopY - frontHeightMm / 2;
  const frontTopFromModuleBaseMm = frontBottomFromModuleBaseMm + frontHeightMm;

  const eps = 0.51;
  const industrialBaseMm =
    params.baseOffsetMm != null && Number.isFinite(params.baseOffsetMm)
      ? Number(params.baseOffsetMm)
      : DRAWER_LOWEST_FRONT_BOTTOM_FROM_MODULE_BASE_MM;
  /** Flush industrial = base da frente no datum GAV_1 (B0 desde topo do fundo). */
  const flushToModuleBase =
    (role === "lowest" || role === "single") &&
    Math.abs(frontBottomFromModuleBaseMm - industrialBaseMm) <= eps;
  /** Flush CIMA = topo da frente no underside do tampo (vão interior H−fundo−tampo). */
  const interiorSpanMm = Math.max(1, boxH - floorT - topT);
  const flushTopTargetMm = floorT > 0 || topT > 0 ? interiorSpanMm : boxH;
  const flushToModuleTop =
    (role === "highest" || role === "single") &&
    Math.abs(frontTopFromModuleBaseMm - flushTopTargetMm) <= eps;

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
