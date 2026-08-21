/**
 * Viewer-only — inversão controlada do desnível vertical corpo ↔ frente.
 *
 * Industrial (SSOT, intocado):
 *   lowest/single elev = 16,5 mm · middle/highest = 48 mm
 *
 * Visual (esta camada, quando activa):
 *   middle/highest: folga pequena na base · elevação industrial no topo
 *   lowest/single: SEM flip — usa elevação industrial 16,5 (bodyBottom módulo = 18,5)
 *
 * Remover / pôr `DRAWER_VIEWER_BODY_VERTICAL_FLIP = false` na revisão industrial futura.
 * Não altera cutlist, XML, furos nem DrawerParametrics.
 */

import {
  DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM,
  DRAWER_LOWEST_BODY_ELEVATION_FROM_FRONT_MM,
} from "../../core/drawers/drawerGeometryConstants";

export const DRAWER_VIEWER_BODY_VERTICAL_FLIP = true;

/** Flip activo só se a flag global estiver ligada e NÃO for elevação GAV_1/single (16,5). */
export function isDrawerViewerBodyVerticalFlipActiveForElevationMm(
  industrialBaseElevationMm: number
): boolean {
  const elev = Number(industrialBaseElevationMm);
  // GAV_1 / single: flip SEMPRE proibido (16,5 industrial ou 18,5 bodyBottom confundido)
  if (
    Number.isFinite(elev) &&
    (Math.abs(elev - DRAWER_LOWEST_BODY_ELEVATION_FROM_FRONT_MM) <= 0.05 ||
      Math.abs(elev - DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM) <= 0.05)
  ) {
    return false;
  }
  if (!DRAWER_VIEWER_BODY_VERTICAL_FLIP) return false;
  if (!Number.isFinite(elev)) return false;
  return true;
}

/**
 * Elevação visual da base do corpo acima da base da frente (mm).
 * Com flip (middle/highest): troca a elevação industrial pela folga que estava no topo.
 * Sem flip (GAV_1/single): devolve a elevação industrial (16,5).
 * Nunca devolve 0 por elevação inválida — fallback SSOT GAV_1 (16,5).
 */
export function resolveDrawerVisualBaseElevationMm(
  frontHeightMm: number,
  bodyHeightMm: number,
  industrialBaseElevationMm: number
): number {
  const elev = Number(industrialBaseElevationMm);
  if (!Number.isFinite(elev)) {
    return DRAWER_LOWEST_BODY_ELEVATION_FROM_FRONT_MM;
  }
  if (!isDrawerViewerBodyVerticalFlipActiveForElevationMm(elev)) {
    return elev;
  }
  const frontH = Math.max(0, Number(frontHeightMm) || 0);
  const bodyH = Math.max(0, Number(bodyHeightMm) || 0);
  const delta = Math.max(0, frontH - bodyH);
  return Math.max(0, delta - elev);
}

/**
 * Offset Y do centro do corpo (mm), origem no centro da frente, Y+ = cima.
 * Equivalente a `resolveDrawerBodyCenterOffsetYMm` com elevação visual.
 */
export function resolveDrawerVisualBodyCenterOffsetYMm(
  frontHeightMm: number,
  bodyHeightMm: number,
  industrialBaseElevationMm: number
): number {
  const frontH = Math.max(0, Number(frontHeightMm) || 0);
  const bodyH = Math.max(0, Number(bodyHeightMm) || 0);
  const elev = resolveDrawerVisualBaseElevationMm(
    frontH,
    bodyH,
    industrialBaseElevationMm
  );
  return -(frontH - bodyH) / 2 + elev;
}
