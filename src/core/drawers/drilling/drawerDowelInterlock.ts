/**
 * SSOT — cavilhas / rasgos de gaveta (golden XML_COMPLITO).
 *
 * Laterais (LAT_DIR / LAT_ESQ):
 *   Face (TypeNo=1): Y = 15 e W?38; X = T/2 (esq) ou L?T/2 (dir); Depth 13
 *   Aresta (TypeNo=2): Y = 15 e W?35; X = 0 (dir) ou L (esq); Depth 30
 *   Rasgos: W?13 (Ø/largura 13, prof. 3) e W?23 (largura 11, prof. 10)
 *
 * Costa: Y = 15 e W?15; Depth 30; topo X=8 / L?8 Depth 10
 * Frente inferior: Y = W?56.5 (rasgo), W?73.5 (cavilha); X = 33
 */

/** Distância industrial da base ao eixo da corrediça no módulo (mm) — inalterado. */
export const DRAWER_SLIDE_OFFSET_FROM_BOTTOM_MM = 41;

export const DRAWER_DOWEL_DIAMETER_MM = 10;
export const DRAWER_DOWEL_FACE_DEPTH_MM = 13;
/** Profundidade na aresta (ao longo do painel, não atravessa T). */
export const DRAWER_DOWEL_EDGE_DEPTH_MM = 30;
/** Folga m²nima legado (face through-thickness). */
export const DRAWER_DOWEL_EDGE_CLEARANCE_MM = 2;

/** Y inferior golden (desde a base). */
export const DRAWER_LAT_DOWEL_Y_FROM_BOTTOM_MM = 15;
/**
 * @deprecated Especialização lowest removida (P3.12) — todas as gavetas usam
 * `DRAWER_LAT_DOWEL_Y_FROM_BOTTOM_MM` (15). Mantido só para compatibilidade de import.
 */
export const DRAWER_LOWEST_LAT_EDGE_DOWEL_Y_FROM_BOTTOM_MM = DRAWER_LAT_DOWEL_Y_FROM_BOTTOM_MM;
/** Face superior: W?38. */
export const DRAWER_LAT_FACE_DOWEL_Y_FROM_TOP_MM = 38;
/** Aresta superior (interlock frente): W?35. */
export const DRAWER_LAT_EDGE_DOWEL_Y_FROM_TOP_MM = 35;
/** Costa: sim²trico 15 mm de cada bordo. */
export const DRAWER_COSTA_DOWEL_Y_FROM_EDGE_MM = 15;

/** @deprecated Prefer DRAWER_LAT_DOWEL_Y_FROM_BOTTOM_MM — alias legado. */
export const DRAWER_REAR_DOWEL_Y_FROM_BOTTOM_MM = DRAWER_LAT_FACE_DOWEL_Y_FROM_TOP_MM;
/** @deprecated Prefer DRAWER_LAT_DOWEL_Y_FROM_BOTTOM_MM. */
export const DRAWER_FRONT_DOWEL_Y_FROM_BOTTOM_MM = DRAWER_LAT_DOWEL_Y_FROM_BOTTOM_MM;

/** Centro do furo na espessura (X ou Z KDT). */
export function drawerThicknessCenterMm(espessuraMm: number): number {
  const t = Math.max(0, Number(espessuraMm) || 0);
  return t / 2;
}

/**
 * Profundidade legado through-thickness: min(30, espessura ? 2).
 * Preferir DRAWER_DOWEL_EDGE_DEPTH_MM (30) para arestas golden.
 */
export function clampDrawerEdgeDowelDepthMm(espessuraMm: number): number {
  const t = Math.max(0, Number(espessuraMm) || 0);
  const maxSafe = Math.max(0, t - DRAWER_DOWEL_EDGE_CLEARANCE_MM);
  return Math.min(DRAWER_DOWEL_EDGE_DEPTH_MM, maxSafe);
}

/** Profundidade em face: 13 mm, nunca > espessura ? 1. */
export function clampDrawerFaceDowelDepthMm(espessuraMm: number): number {
  const t = Math.max(0, Number(espessuraMm) || 0);
  if (t <= 0) return DRAWER_DOWEL_FACE_DEPTH_MM;
  return Math.min(DRAWER_DOWEL_FACE_DEPTH_MM, Math.max(1, t - 1));
}

/** Y face laterais (TypeNo=1): 15 e H?38. */
export function getDrawerLateralFaceDowelYPositionsMm(alturaMm: number): number[] {
  const h = Math.max(0, Number(alturaMm) || 0);
  const y0 = DRAWER_LAT_DOWEL_Y_FROM_BOTTOM_MM;
  const y1 = h - DRAWER_LAT_FACE_DOWEL_Y_FROM_TOP_MM;
  if (h <= 0) return [];
  if (y1 <= y0 + 1) return [Math.min(y0, h / 2)];
  return [y0, y1];
}

/**
 * Y aresta laterais (TypeNo=2, interlock frente): 15 e H−35.
 * Todas as gavetas (incl. 01 / lowest) partilham a mesma tabela — coerência industrial.
 * `isLowestDrawer` ignorado (legado).
 */
export function getDrawerLateralEdgeDowelYPositionsMm(
  alturaMm: number,
  _isLowestDrawer?: boolean
): number[] {
  void _isLowestDrawer;
  const h = Math.max(0, Number(alturaMm) || 0);
  const y0 = DRAWER_LAT_DOWEL_Y_FROM_BOTTOM_MM;
  const y1 = h - DRAWER_LAT_EDGE_DOWEL_Y_FROM_TOP_MM;
  if (h <= 0) return [];
  if (y1 <= y0 + 1) return [Math.min(y0, h / 2)];
  return [y0, y1];
}

/** Y costa: 15 e H?15. */
export function getDrawerCostaDowelYPositionsMm(alturaMm: number): number[] {
  const h = Math.max(0, Number(alturaMm) || 0);
  const y = DRAWER_COSTA_DOWEL_Y_FROM_EDGE_MM;
  if (h <= 0) return [];
  if (h < y * 2 + 1) return [Math.min(y, h / 2)];
  return [y, h - y];
}

/**
 * @deprecated Use getDrawerLateralFaceDowelYPositionsMm.
 * Mantido para callers legados (costa sync antigo).
 */
export function getDrawerRearDowelYPositionsMm(alturaMm: number): number[] {
  return getDrawerLateralFaceDowelYPositionsMm(alturaMm);
}

/**
 * Y frontais sincronizados com aresta das laterais (15 / H?35).
 * `isLowestDrawer` ignorado no modelo golden (mesma tabela).
 */
export function getDrawerFrontDowelYPositionsMm(
  alturaMm: number,
  _isLowestDrawer?: boolean
): number[] {
  return getDrawerLateralEdgeDowelYPositionsMm(alturaMm);
}

export function assertDowelDoesNotThrough(
  profundidadeMm: number,
  espessuraMm: number
): boolean {
  return profundidadeMm > 0 && profundidadeMm < espessuraMm;
}
