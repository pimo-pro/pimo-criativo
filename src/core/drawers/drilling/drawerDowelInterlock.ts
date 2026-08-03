/**
 * SSOT � cavilhas / rasgos de gaveta.
 *
 * Laterais gaveta_lat_* (SSOT oficial `cx gav lat`, transversal):
 *   L = altura, W = profundidade
 *   Cavilhas TypeNo=2 �10�30: X=0 e X=L; Y=60 e Y=W?60
 *   Guias TypeNo=1 �5�1: grelha 3�5 (dir; esq espelhado L?x); margem Y=38
 *   Sem rasgos TypeNo=3; sem cavilhas face TypeNo=1
 *
 * Frente / costa (inalterado � interlock Y):
 *   Costa: Y = 15 e H?15; Depth 30; topo X=8 / L?8 Depth 10
 *   Frente: Y sync aresta legado 15 / H?35
 */

/** Dist�ncia industrial da base ao eixo da corredi�a no m�dulo (mm) � inalterado. */
export const DRAWER_SLIDE_OFFSET_FROM_BOTTOM_MM = 41;

export const DRAWER_DOWEL_DIAMETER_MM = 10;
export const DRAWER_DOWEL_FACE_DEPTH_MM = 13;
/** Profundidade na aresta (ao longo do painel, n�o atravessa T). */
export const DRAWER_DOWEL_EDGE_DEPTH_MM = 30;
/** Folga m�nima legado (face through-thickness). */
export const DRAWER_DOWEL_EDGE_CLEARANCE_MM = 2;

/** Y inferior golden (desde a base) � frente / costa / legado. */
export const DRAWER_LAT_DOWEL_Y_FROM_BOTTOM_MM = 15;
/** Face superior legado: H?38. */
export const DRAWER_LAT_FACE_DOWEL_Y_FROM_TOP_MM = 38;
/** Aresta superior (interlock frente): H?35. */
export const DRAWER_LAT_EDGE_DOWEL_Y_FROM_TOP_MM = 35;
/** Costa: sim�trico 15 mm de cada bordo. */
export const DRAWER_COSTA_DOWEL_Y_FROM_EDGE_MM = 15;

/** Cavilhas transversais laterais � Y desde cada bordo em W (profundidade). */
export const DRAWER_LAT_TRANSVERSAL_DOWEL_Y_FROM_EDGE_MM = 60;
/** Grelha �5 � X frente (SSOT cx gav lat). */
export const DRAWER_LAT_GUIDE_X_FRONT_MM = 41;
/** Grelha �5 � margem Y (5 linhas). */
export const DRAWER_LAT_GUIDE_Y_MARGIN_MM = 38;
export const DRAWER_LAT_GUIDE_DIAMETER_MM = 5;
export const DRAWER_LAT_GUIDE_DEPTH_MM = 1;
export const DRAWER_LAT_GUIDE_ROWS = 5;

/** @deprecated Prefer DRAWER_LAT_DOWEL_Y_FROM_BOTTOM_MM � alias legado. */
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

/** Y aresta laterais (TypeNo=2, interlock frente): 15 e H?35. */
export function getDrawerLateralEdgeDowelYPositionsMm(alturaMm: number): number[] {
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
 * Y frontais sincronizados com tabela aresta legado (15 / H?35).
 * `isLowestDrawer` ignorado no modelo golden (mesma tabela).
 */
export function getDrawerFrontDowelYPositionsMm(
  alturaMm: number,
  _isLowestDrawer?: boolean
): number[] {
  return getDrawerLateralEdgeDowelYPositionsMm(alturaMm);
}

/**
 * Y cavilhas transversais gaveta_lat_* (SSOT cx gav lat): 60 e W?60.
 * `depthMm` = profundidade do painel (cutlist.largura / XML PanelWidth).
 */
export function getDrawerLateralTransversalDowelYPositionsMm(depthMm: number): number[] {
  const w = Math.max(0, Number(depthMm) || 0);
  const y = DRAWER_LAT_TRANSVERSAL_DOWEL_Y_FROM_EDGE_MM;
  if (w <= 0) return [];
  if (w < y * 2 + 1) return [Math.min(y, w / 2)];
  return [y, w - y];
}

/**
 * Colunas X da grelha �5 (SSOT cx_gav_lat_dir L=862 ? 41 / 323.33 / 624.67).
 * Param�trico: frente fixa 41 + L/3+36 + 2L/3+50.
 */
export function getDrawerLateralGuideXPositionsMm(panelLengthMm: number): number[] {
  const L = Math.max(0, Number(panelLengthMm) || 0);
  if (L <= 0) return [];
  const GOLDEN_L = 862;
  const front = DRAWER_LAT_GUIDE_X_FRONT_MM;
  const xs = [
    front,
    Number(((L * 323.33) / GOLDEN_L).toFixed(2)),
    Number(((L * 624.67) / GOLDEN_L).toFixed(2)),
  ];
  return xs.filter((x) => x > 0 && x < L);
}

/** Linhas Y da grelha �5: 5 pontos com margem 38 (SSOT). */
export function getDrawerLateralGuideYPositionsMm(panelWidthMm: number): number[] {
  const W = Math.max(0, Number(panelWidthMm) || 0);
  const m = DRAWER_LAT_GUIDE_Y_MARGIN_MM;
  const n = DRAWER_LAT_GUIDE_ROWS;
  if (W <= 0) return [];
  if (W <= m * 2) return [Number((W / 2).toFixed(2))];
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(Number((m + (i * (W - 2 * m)) / (n - 1)).toFixed(2)));
  }
  return out;
}

export function assertDowelDoesNotThrough(
  profundidadeMm: number,
  espessuraMm: number
): boolean {
  return profundidadeMm > 0 && profundidadeMm < espessuraMm;
}
