/**
 * FASE 3 — Layout Engine
 * Funções auxiliares (skeleton).
 */

import type { LayoutDimensionsMm, LayoutPosition } from "./types";

/**
 * Converte mm para metros (1 m = 1000 mm).
 * @placeholder Pode delegar em utils/units se existir.
 */
export function mmToMeters(_mm: number): number {
  return _mm / 1000;
}

/**
 * Converte metros para mm.
 */
export function metersToMm(_m: number): number {
  return _m * 1000;
}

/**
 * Calcula volume em mm³ a partir de dimensões.
 * @placeholder Sem lógica real.
 */
export function volumeMm3(_dims: LayoutDimensionsMm): number {
  return _dims.largura * _dims.altura * _dims.profundidade;
}

/**
 * Verifica se duas posições são iguais (com tolerância).
 * @placeholder Sem lógica real.
 */
export function positionsEqual(
  _a: LayoutPosition,
  _b: LayoutPosition,
  _toleranceMm?: number
): boolean {
  return false;
}
