/**
 * Posicionamento vertical unificado das gavetas.
 * Empilhamento dinâmico: bottom[i+1] = top[i] + G — zero sobreposição (salvo unlock futuro).
 * Slide Y = frenteBottom + 41 (piso industrial).
 */

import {
  DRAWER_LOWEST_FRONT_BOTTOM_FROM_MODULE_BASE_MM,
  DRAWER_STACK_GAVETA1_ADJUST_MM,
  DRAWER_VERTICAL_GAP_MM,
} from "./drawerGeometryConstants";

export { DRAWER_VERTICAL_GAP_MM };

/**
 * Offset da 1ª frente relativamente à base do módulo (mm).
 * SSOT = `DRAWER_LOWEST_FRONT_BOTTOM_FROM_MODULE_BASE_MM` (Diff 3: B0 = 0).
 */
export const DRAWER_VERTICAL_BASE_OFFSET_MM = DRAWER_LOWEST_FRONT_BOTTOM_FROM_MODULE_BASE_MM;

export function getDrawerUsableInternalHeightMm(boxInternalHeightMm: number): number {
  return Math.max(1, boxInternalHeightMm - DRAWER_VERTICAL_BASE_OFFSET_MM);
}

/**
 * Alturas equal_quase (produção `"equal"`):
 *   distributable = H − B0 − G·(n−1)
 *   hEqual = (distributable − ajuste) / n
 *   frente(0) = hEqual + ajuste (−2)
 *   frente(i>0) = (distributable − frente(0)) / (n−1)
 */
export function calculateEqualQuaseDrawerHeights(
  count: number,
  distributableMm: number,
  ajusteGaveta1Mm: number = DRAWER_STACK_GAVETA1_ADJUST_MM
): number[] {
  const n = Math.max(0, Math.floor(count));
  if (n <= 0) return [];
  const distributable = Math.max(1, Number(distributableMm) || 1);
  if (n === 1) return [distributable];

  const ajuste = Number.isFinite(ajusteGaveta1Mm) ? ajusteGaveta1Mm : DRAWER_STACK_GAVETA1_ADJUST_MM;
  const hEqual = (distributable - ajuste) / n;
  const first = hEqual + ajuste;
  const restEach = (distributable - first) / (n - 1);
  return [first, ...Array.from({ length: n - 1 }, () => restEach)];
}

/**
 * Centro Y da gaveta no sistema local do módulo (mm, origem no centro do box).
 * Índice 0 = gaveta inferior; último = gaveta superior.
 */
export function resolveDrawerVerticalPosition(
  drawerIndex: number,
  drawerHeights: number[],
  boxInternalHeightMm: number,
  baseOffsetMm: number = DRAWER_VERTICAL_BASE_OFFSET_MM
): number {
  let offsetY = 0;
  for (let i = 0; i < drawerIndex; i++) {
    offsetY += Number.isFinite(drawerHeights[i]) ? drawerHeights[i]! : 0;
    offsetY += DRAWER_VERTICAL_GAP_MM;
  }
  const height = drawerHeights[drawerIndex] ?? 0;
  return -boxInternalHeightMm / 2 + baseOffsetMm + offsetY + height / 2;
}

export function resolveDrawerVerticalPositions(
  drawerHeights: number[],
  boxInternalHeightMm: number,
  baseOffsetMm: number = DRAWER_VERTICAL_BASE_OFFSET_MM,
  _options?: { topPanelThicknessMm?: number }
): number[] {
  return drawerHeights.map((_, index) =>
    resolveDrawerVerticalPosition(index, drawerHeights, boxInternalHeightMm, baseOffsetMm)
  );
}
