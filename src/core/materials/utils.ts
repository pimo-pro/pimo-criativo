/**
 * FASE 3 — Materials System
 * Funções auxiliares (skeleton).
 */

import type { MaterialPreset } from "./types";

/**
 * Normaliza ID de categoria para comparação.
 * @placeholder Sem lógica real.
 */
export function normalizeCategoryId(_id: string): string {
  return _id.trim().toLowerCase();
}

/**
 * Obtém preset por ID (busca em lista).
 * @placeholder Sem lógica real.
 */
export function getPresetById(
  _presets: MaterialPreset[],
  _presetId: string
): MaterialPreset | null {
  return null;
}

/**
 * Valida se um preset é aplicável a uma parte.
 * @placeholder Sem lógica real.
 */
export function canApplyPresetToPart(
  _presetId: string,
  _partId: string
): boolean {
  return true;
}
