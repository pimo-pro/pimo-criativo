/**
 * Posicionamento vertical unificado das gavetas.
 * Datum industrial: face SUPERIOR do fundo do módulo (não a face inferior do painel).
 * Empilhamento: bottom[i+1] = top[i] + G — zero sobreposição (salvo unlock futuro).
 */

import {
  DRAWER_LOWEST_FRONT_BOTTOM_FROM_MODULE_BASE_MM,
  DRAWER_STACK_GAVETA1_ADJUST_MM,
  DRAWER_VERTICAL_GAP_MM,
} from "./drawerGeometryConstants";

export { DRAWER_VERTICAL_GAP_MM };

/**
 * Offset da 1ª frente relativamente à face superior do fundo (mm).
 * SSOT = `DRAWER_LOWEST_FRONT_BOTTOM_FROM_MODULE_BASE_MM` (B0 = 2 mm).
 */
export const DRAWER_VERTICAL_BASE_OFFSET_MM = DRAWER_LOWEST_FRONT_BOTTOM_FROM_MODULE_BASE_MM;

export type DrawerVerticalLayoutOptions = {
  /** Espessura do fundo (mm). 0 = legado (datum = face inferior externa). */
  floorThicknessMm?: number;
  /** Espessura do tampo (mm). Default = floorThicknessMm. */
  topPanelThicknessMm?: number;
};

/**
 * Y local do box (mm, origem no centro) da face superior do fundo.
 * Viewer: painel fundo centrado em -H/2+T/2 → topo em -H/2+T.
 * Com T=0 o datum legado (-H/2) é proibido em produção — Generation passa sempre T>0.
 */
export function resolveModuleFloorTopYMm(
  boxHeightMm: number,
  floorThicknessMm: number = 0
): number {
  const H = Math.max(1, Number(boxHeightMm) || 1);
  const T = Math.max(0, Number(floorThicknessMm) || 0);
  if (!(T > 0)) {
    throw new Error(
      "[SSOT floorTop] floorThicknessMm deve ser > 0 (datum = face superior do fundo; sem fallback -H/2)"
    );
  }
  return -H / 2 + T;
}

/**
 * Altura útil para distribuição de frentes (mm).
 * Com T>0: vão interior (H − fundo − tampo) − B0.
 * Com T=0: legado H − B0.
 */
export function getDrawerUsableInternalHeightMm(
  boxHeightMm: number,
  options?: DrawerVerticalLayoutOptions
): number {
  const H = Math.max(1, Number(boxHeightMm) || 1);
  const floorT = Math.max(0, Number(options?.floorThicknessMm) || 0);
  const topT = Math.max(0, Number(options?.topPanelThicknessMm) || floorT);
  const interiorSpan = Math.max(1, H - floorT - topT);
  return Math.max(1, interiorSpan - DRAWER_VERTICAL_BASE_OFFSET_MM);
}

/**
 * Alturas equal_quase (produção `"equal"`):
 *   distributable = usable − G·(n−1)
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
 * Datum: face superior do fundo + B0 (não a face inferior do painel).
 */
export function resolveDrawerVerticalPosition(
  drawerIndex: number,
  drawerHeights: number[],
  boxHeightMm: number,
  baseOffsetMm: number = DRAWER_VERTICAL_BASE_OFFSET_MM,
  options?: DrawerVerticalLayoutOptions
): number {
  let offsetY = 0;
  for (let i = 0; i < drawerIndex; i++) {
    offsetY += Number.isFinite(drawerHeights[i]) ? drawerHeights[i]! : 0;
    offsetY += DRAWER_VERTICAL_GAP_MM;
  }
  const height = drawerHeights[drawerIndex] ?? 0;
  const floorT = Math.max(0, Number(options?.floorThicknessMm) || 0);
  // Produção: sempre T>0 → floorTop. Sem T: só testes unitários de distribuição (legado).
  const floorTopY =
    floorT > 0
      ? resolveModuleFloorTopYMm(boxHeightMm, floorT)
      : -Math.max(1, Number(boxHeightMm) || 1) / 2;
  return floorTopY + baseOffsetMm + offsetY + height / 2;
}

export function resolveDrawerVerticalPositions(
  drawerHeights: number[],
  boxHeightMm: number,
  baseOffsetMm: number = DRAWER_VERTICAL_BASE_OFFSET_MM,
  options?: DrawerVerticalLayoutOptions
): number[] {
  return drawerHeights.map((_, index) =>
    resolveDrawerVerticalPosition(
      index,
      drawerHeights,
      boxHeightMm,
      baseOffsetMm,
      options
    )
  );
}
