/**
 * Kerf de layout para nesting que alimenta TCN/CNC.
 * Extraído de `tcnGenerator.ts` (Fase 7b A) para não acoplar o nesting de
 * NESTING MO / v2_new aos geradores legados v1–v6.
 */

import { getSettings } from "../settings/settingsService";

const DEFAULT_MIN_SPACING_BETWEEN_PIECES_MM = 15;
const TOOL_113_NOMINAL_DIAMETER_MM = 12;
const MIN_TOOL_DIAMETER_MM = 1;

function getContourToolDiameterMm(settings: {
  cnc?: { diametroFresaContornoMm?: number };
}): number {
  const fromCnc = Number(settings?.cnc?.diametroFresaContornoMm);
  if (Number.isFinite(fromCnc) && fromCnc > 0) return Math.max(MIN_TOOL_DIAMETER_MM, fromCnc);
  return TOOL_113_NOMINAL_DIAMETER_MM;
}

/**
 * Kerf usado no motor de nesting quando o resultado alimenta TCN/CNC:
 * distância mínima entre arestas das peças no layout tal que, com offset exterior +R,
 * o espaço entre contornos de ferramenta seja ≥ `cnc.minSpacingMm`.
 */
export function getLayoutKerfMmForCncNesting(settings: {
  cnc?: { diametroFresaContornoMm?: number; minSpacingMm?: number };
} = getSettings()): number {
  const toolRadiusMm = getContourToolDiameterMm(settings) / 2;
  const minSpacingMm = Number.isFinite(Number(settings?.cnc?.minSpacingMm))
    ? Math.max(0, Number(settings?.cnc?.minSpacingMm))
    : DEFAULT_MIN_SPACING_BETWEEN_PIECES_MM;
  return minSpacingMm + 2 * Math.max(0, toolRadiusMm);
}
