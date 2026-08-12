/**
 * Stack vertical dinâmico das gavetas (anti-sobreposição).
 * SolidWorks = referência de proporções (descontos laterais), não de alturas/bottoms fixos.
 *
 * h_i = (H − B0 − G×(n−1)) / n
 * bottom[i+1] = bottom[i] + h[i] + G
 * slide[i] = bottom[i] + 41
 */

import { settingsDefaults } from "../settings/settingsSchema";
import type { DrawerStackRole } from "./drawerStackPosition";
import {
  DRAWER_LOWEST_SIDE_HEIGHT_RATIO,
  DRAWER_VERTICAL_GAP_MM,
} from "./drawerGeometryConstants";

/** Folga: frente superior cobre CIMA e desce 2 mm abaixo da face inferior. */
export const DRAWER_TOP_FRONT_CIMA_OVERHANG_BELOW_MM = 2;

/**
 * @deprecated Preferir settings.gavetas.gavetaReducaoPercentual.
 * Valor legado (mm) — não usar em geometria nova.
 */
export const DRAWER_LATERAL_HEIGHT_BELOW_FRONT_MM = 64.5;
/** @deprecated Alias legado. */
export const DRAWER_LATERAL_HEIGHT_BELOW_FRONT_LOWEST_MM = DRAWER_LATERAL_HEIGHT_BELOW_FRONT_MM;
/** @deprecated Alias legado. */
export const DRAWER_LATERAL_HEIGHT_BELOW_FRONT_OTHER_MM = DRAWER_LATERAL_HEIGHT_BELOW_FRONT_MM;

/**
 * Converte % Admin (inteiro) → factor decimal: 25 → 0,75.
 * laterais = frente × factor; costa = laterais × factor.
 */
export function drawerReductionPercentToFactor(percent: number): number {
  const p = Math.round(Number(percent));
  const safe = Number.isFinite(p)
    ? p
    : settingsDefaults.gavetas.gavetaReducaoPercentual;
  return Math.max(0.01, Math.min(0.99, 1 - safe / 100));
}

/** Factor default a partir de settings.gavetas.gavetaReducaoPercentual. */
export function resolveDefaultDrawerHeightReductionFactor(): number {
  return drawerReductionPercentToFactor(settingsDefaults.gavetas.gavetaReducaoPercentual);
}

/**
 * Altura madeira das laterais: sideH = frontH × heightRatio.
 * GAV_1 (lowest): R_real = 0,685. Restantes: factor Admin (default 0,75).
 */
export function resolveDrawerWoodBodyHeightForStackRoleMm(
  frontHeightMm: number,
  stackRole: DrawerStackRole = "middle",
  heightRatio?: number
): number {
  const frontH = Math.max(0, Number(frontHeightMm) || 0);
  const ratio =
    heightRatio != null && Number.isFinite(heightRatio) && heightRatio > 0
      ? heightRatio
      : stackRole === "lowest"
        ? DRAWER_LOWEST_SIDE_HEIGHT_RATIO
        : resolveDefaultDrawerHeightReductionFactor();
  return Math.max(1, frontH * ratio);
}

export type DynamicDrawerStackLayout = {
  heights: number[];
  bottoms: number[];
  tops: number[];
  slides: number[];
  gapMm: number;
  boxHeightMm: number;
  baseFrontMm: number;
};

/**
 * Layout equal dinâmico sem sobreposição.
 * `slideOffsetFromBottomMm` default 41 (piso industrial).
 */
export function resolveDynamicEqualDrawerStackLayout(params: {
  count: number;
  boxHeightMm: number;
  baseFrontMm?: number;
  gapMm?: number;
  slideOffsetFromBottomMm?: number;
}): DynamicDrawerStackLayout {
  const n = Math.max(0, Math.floor(params.count));
  const H = Math.max(1, Number(params.boxHeightMm) || 1);
  const B0 = Math.max(0, Number(params.baseFrontMm) || 0);
  const G = params.gapMm != null && Number.isFinite(params.gapMm)
    ? Math.max(0, params.gapMm)
    : DRAWER_VERTICAL_GAP_MM;
  const slideOff =
    params.slideOffsetFromBottomMm != null && Number.isFinite(params.slideOffsetFromBottomMm)
      ? Math.max(0, params.slideOffsetFromBottomMm)
      : 41;

  if (n <= 0) {
    return { heights: [], bottoms: [], tops: [], slides: [], gapMm: G, boxHeightMm: H, baseFrontMm: B0 };
  }

  const distributable = Math.max(1, H - B0 - G * (n - 1));
  const h = distributable / n;
  const heights = Array.from({ length: n }, () => h);
  const bottoms: number[] = [];
  const tops: number[] = [];
  const slides: number[] = [];
  for (let i = 0; i < n; i++) {
    const bottom = i === 0 ? B0 : bottoms[i - 1]! + heights[i - 1]! + G;
    bottoms.push(bottom);
    tops.push(bottom + h);
    slides.push(bottom + slideOff);
  }
  return { heights, bottoms, tops, slides, gapMm: G, boxHeightMm: H, baseFrontMm: B0 };
}

/** Gaps entre frentes consecutivas; negativos = sobreposição (mm). */
export function measureDrawerFrontGapsMm(bottoms: number[], tops: number[]): number[] {
  const gaps: number[] = [];
  for (let i = 0; i < bottoms.length - 1; i++) {
    gaps.push((bottoms[i + 1] ?? 0) - (tops[i] ?? 0));
  }
  return gaps;
}

export function assertNoDrawerFrontOverlap(params: {
  bottoms: number[];
  tops: number[];
  minGapMm?: number;
  allowOverlap?: boolean;
}): { ok: boolean; gapsMm: number[]; overlapsMm: number[] } {
  const minGap = params.minGapMm ?? DRAWER_VERTICAL_GAP_MM;
  const gapsMm = measureDrawerFrontGapsMm(params.bottoms, params.tops);
  const overlapsMm = gapsMm.map((g) => (g < minGap - 1e-6 ? minGap - g : 0));
  const hasOverlap = overlapsMm.some((o) => o > 1e-6);
  return {
    ok: params.allowOverlap === true ? true : !hasOverlap,
    gapsMm,
    overlapsMm,
  };
}

/** Confirma overlay CIMA: topo ≥ H e bottom ≤ (H−T)−2. */
export function assertTopFrontCoversCimaWithClearance(params: {
  boxExternalHeightMm: number;
  topPanelThicknessMm: number;
  frontTopMm: number;
  frontBottomMm: number;
  clearanceBelowCimaMm?: number;
}): {
  cimaUndersideMm: number;
  coverThroughCimaMm: number;
  extendsBelowUndersideMm: number;
  ok: boolean;
} {
  const H = Math.max(1, params.boxExternalHeightMm);
  const T = Math.max(0, params.topPanelThicknessMm);
  const clearance = params.clearanceBelowCimaMm ?? DRAWER_TOP_FRONT_CIMA_OVERHANG_BELOW_MM;
  const cimaUndersideMm = H - T;
  const coverThroughCimaMm = params.frontTopMm - cimaUndersideMm;
  const extendsBelowUndersideMm = cimaUndersideMm - params.frontBottomMm;
  const ok =
    params.frontTopMm + 1e-6 >= H &&
    params.frontBottomMm <= cimaUndersideMm - clearance + 1e-6;
  return { cimaUndersideMm, coverThroughCimaMm, extendsBelowUndersideMm, ok };
}

/** @deprecated Removido do stack de produção — usar resolveDynamicEqualDrawerStackLayout. */
export function isSolidWorksThreeDrawerEqualStack(_count: number, _mode: string): boolean {
  return false;
}
