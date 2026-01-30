/**
 * Conversão de unidades: calculadora usa mm, viewer/Three.js usa 1 unidade = 1 m.
 * Usar sempre na fronteira (UI/calculadora → viewer) ao passar width, height, depth, thickness.
 */
export const MM_TO_M = 1 / 1000;
export const M_TO_MM = 1000;

export function mmToM(mm: number): number {
  return mm * MM_TO_M;
}

export function mToMm(m: number): number {
  return m * M_TO_MM;
}
