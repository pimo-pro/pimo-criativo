import { getSettings } from "../settings/settingsService";

export const CUT_LAYOUT_SAFETY_MARGIN_MM = 5;

export type LayoutXOrigin = "left" | "right";

export const CUT_LAYOUT_X_ORIGIN: LayoutXOrigin = "right";

export function toLayoutAbsoluteX(xAbsMm: number, sheetWidthMm: number): number {
  if (CUT_LAYOUT_X_ORIGIN === "right") {
    return sheetWidthMm - xAbsMm;
  }
  return xAbsMm;
}

export function toLayoutPlacementX(xMm: number, widthMm: number, sheetWidthMm: number): number {
  if (CUT_LAYOUT_X_ORIGIN === "right") {
    return sheetWidthMm - (xMm + widthMm);
  }
  return xMm;
}

/**
 * Converte (hx, hy) no espaço da peça (origem canto inferior-esquerdo da peça na cutlist,
 * X ao longo da largura, Y ao longo da altura) para offset no retângulo de colocação na chapa
 * (origem canto inferior-esquerdo do placement), com rotação 0 ou 90° do nesting.
 */
export function holeLocalToSheetOffsetMm(
  hx: number,
  hy: number,
  rotacaoDeg: number,
  pieceLarguraMm?: number,
  pieceAlturaMm?: number,
  designLarguraMm?: number,
  designAlturaMm?: number
): { sx: number; sy: number } {
  const r = ((rotacaoDeg ?? 0) % 360 + 360) % 360;
  const plW = pieceLarguraMm ?? 0;
  const plH = pieceAlturaMm ?? 0;
  const swaps = r === 90 || r === 270;
  const origW = designLarguraMm ?? (swaps ? plH : plW);
  const origH = designAlturaMm ?? (swaps ? plW : plH);

  if (r === 90) return { sx: hy, sy: origW - hx };
  if (r === 180) return { sx: origW - hx, sy: origH - hy };
  if (r === 270) return { sx: origH - hy, sy: hx };
  return { sx: hx, sy: hy };
}

/**
 * Converte coordenadas de furo no espaço original da peça (pré-rotação, pré-espelho)
 * para offset relativo ao canto superior-esquerdo do placement no sistema TRO (Top-Right Origin).
 * Use este offset para desenhar furos no PDF: hxAbs = pl.x_mm + dx, hyPdf = py + dy*scale.
 *
 * Fórmulas derivadas analiticamente para rot=0 e rot=90:
 *   rot=0:  dx = plLargura - hx_orig,  dy = plAltura - hy_orig
 *   rot=90: dx = plLargura - hy_orig,  dy = hx_orig
 */
export function holeToTroPdfDisplayOffset(
  hx: number,
  hy: number,
  rotacao: number,
  plLargura: number,
  plAltura: number
): { dx: number; dy: number } {
  const r = ((rotacao ?? 0) % 360 + 360) % 360;
  if (r === 90) {
    return { dx: Math.max(0, plLargura - hy), dy: Math.max(0, hx) };
  }
  return { dx: Math.max(0, plLargura - hx), dy: Math.max(0, plAltura - hy) };
}

/**
 * Offset do furo para display no PDF em coordenadas FÍSICAS (origem A-C = topo-esquerdo da chapa).
 * dx = distância do furo ao lado A (esquerda) da peça — X cresce em direção a B (direita).
 * dy = distância do furo ao lado C (topo) da peça  — Y cresce em direção a D (base).
 *
 * rot=0:    dx = hx_orig,  dy = plAltura - hy_orig
 * rot=90 CW: dx = hy_orig,  dy = hx_orig
 *
 * Uso no PDF (diagrama):  hx = originX + (piecePhysLeft + off.dx) * scale
 *                         hy = py + off.dy * scale
 * Uso no PDF (miniatura): hx = rx + (off.dx / pl.largura_mm) * rw
 *                         hy = ry + (off.dy / pl.altura_mm) * rh
 */
export function holePhysicalDisplayOffset(
  hx: number,
  hy: number,
  rotacao: number,
  plAltura: number
): { dx: number; dy: number } {
  const r = ((rotacao ?? 0) % 360 + 360) % 360;
  if (r === 90) {
    // rot=90 CW: eixo-largura original → topo da peça colocada; eixo-altura original → lado A da peça colocada
    return { dx: Math.max(0, hy), dy: Math.max(0, hx) };
  }
  // rot=0: posição física directa (hx de A, hy de D → converter para y-de-C)
  return { dx: Math.max(0, hx), dy: Math.max(0, plAltura - hy) };
}

export function getSheetSafetyMarginMm(): number {
  try {
    const s = getSettings();
    return s?.cnc?.sheetMarginMm ?? CUT_LAYOUT_SAFETY_MARGIN_MM;
  } catch {
    return CUT_LAYOUT_SAFETY_MARGIN_MM;
  }
}
