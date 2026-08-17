/**
 * TAMPO Fase 5 — configuração de ângulo (trapézio frente ≠ trás).
 * Opcional: null/undefined → tampo retangular (comportamento Fases 1–4).
 */

import { MDB_LAMINADO_SHEET_LF_MM } from "../materials/materials.api";
import { TAMPO_FIXED_WIDTH_MM } from "./tampoCozinhaRules";

export type TampoAngleConfig = {
  /** Comprimento frontal (face do utilizador) em mm */
  frontLengthMm: number;
  /** Comprimento traseiro (lado da parede) em mm */
  backLengthMm: number;
  /** Ângulo em graus do lado lateral face à perpendicular (derivado das comprimentos). */
  angleDeg: number;
};

export type TampoAngleValidation = {
  ok: boolean;
  errors: string[];
};

export const TAMPO_ANGLE_MAX_LENGTH_MM = MDB_LAMINADO_SHEET_LF_MM; // 3660
export const TAMPO_ANGLE_MIN_DEG = -60;
export const TAMPO_ANGLE_MAX_DEG = 60;
export const TAMPO_ANGLE_RECT_EPS_MM = 1;
export const TAMPO_ANGLE_RECT_EPS_DEG = 0.5;
export const TAMPO_ANGLE_COHERENCE_DEG = 1;

export function computeTampoAngleDegFromLengths(
  frontLengthMm: number,
  backLengthMm: number,
  widthMm: number = TAMPO_FIXED_WIDTH_MM
): number {
  const W = Math.max(1, Number(widthMm) || TAMPO_FIXED_WIDTH_MM);
  const deltaHalf = (Number(backLengthMm) - Number(frontLengthMm)) / 2;
  return (Math.atan2(deltaHalf, W) * 180) / Math.PI;
}

export function createDefaultTampoAngleConfig(baseLengthMm: number): TampoAngleConfig {
  const L = Math.max(1, Number(baseLengthMm) || 600);
  return {
    frontLengthMm: L,
    backLengthMm: L,
    angleDeg: 0,
  };
}

export function isTampoAngleRectangular(
  cfg: Pick<TampoAngleConfig, "frontLengthMm" | "backLengthMm" | "angleDeg">
): boolean {
  const front = Number(cfg.frontLengthMm) || 0;
  const back = Number(cfg.backLengthMm) || 0;
  const angle = Number(cfg.angleDeg) || 0;
  return (
    Math.abs(front - back) <= TAMPO_ANGLE_RECT_EPS_MM &&
    Math.abs(angle) <= TAMPO_ANGLE_RECT_EPS_DEG
  );
}

/**
 * Se retangular → null; senão sincroniza angleDeg a partir de frente/trás.
 */
export function normalizeTampoAngleConfig(
  cfg: TampoAngleConfig | null | undefined,
  widthMm: number = TAMPO_FIXED_WIDTH_MM
): TampoAngleConfig | null {
  if (cfg == null) return null;
  const front = Number(cfg.frontLengthMm);
  const back = Number(cfg.backLengthMm);
  if (!Number.isFinite(front) || !Number.isFinite(back)) return null;
  const synced: TampoAngleConfig = {
    frontLengthMm: front,
    backLengthMm: back,
    angleDeg: computeTampoAngleDegFromLengths(front, back, widthMm),
  };
  if (isTampoAngleRectangular(synced)) return null;
  return synced;
}

export function validateTampoAngleConfig(
  cfg: TampoAngleConfig | null | undefined,
  base: { widthMm: number; heightMm: number }
): TampoAngleValidation {
  if (cfg == null) return { ok: true, errors: [] };

  const errors: string[] = [];
  const front = Number(cfg.frontLengthMm);
  const back = Number(cfg.backLengthMm);
  const angle = Number(cfg.angleDeg);
  const widthMm = Math.max(1, Number(base.heightMm) || TAMPO_FIXED_WIDTH_MM);

  if (!(front > 0)) errors.push("Ângulo TAMPO: comprimento frontal deve ser > 0.");
  if (!(back > 0)) errors.push("Ângulo TAMPO: comprimento traseiro deve ser > 0.");
  if (front > TAMPO_ANGLE_MAX_LENGTH_MM) {
    errors.push(
      `Ângulo TAMPO: frente máxima ${TAMPO_ANGLE_MAX_LENGTH_MM} mm (recebido ${front} mm).`
    );
  }
  if (back > TAMPO_ANGLE_MAX_LENGTH_MM) {
    errors.push(
      `Ângulo TAMPO: trás máximo ${TAMPO_ANGLE_MAX_LENGTH_MM} mm (recebido ${back} mm).`
    );
  }
  if (!Number.isFinite(angle) || angle < TAMPO_ANGLE_MIN_DEG || angle > TAMPO_ANGLE_MAX_DEG) {
    errors.push(
      `Ângulo TAMPO: ângulo deve estar entre ${TAMPO_ANGLE_MIN_DEG}° e ${TAMPO_ANGLE_MAX_DEG}° (recebido ${angle}°).`
    );
  } else if (front > 0 && back > 0) {
    const expected = computeTampoAngleDegFromLengths(front, back, widthMm);
    if (Math.abs(angle - expected) > TAMPO_ANGLE_COHERENCE_DEG) {
      errors.push(
        `Ângulo TAMPO: incoerente com frente/trás (esperado ≈${expected.toFixed(1)}°, recebido ${angle}°).`
      );
    }
  }

  void base.widthMm;
  return { ok: errors.length === 0, errors };
}

export function isTampoAngularConfig(
  cfg: TampoAngleConfig | null | undefined,
  widthMm: number = TAMPO_FIXED_WIDTH_MM
): boolean {
  return normalizeTampoAngleConfig(cfg, widthMm) != null;
}

/** Pose local para o trapézio assentar no chão (Y-up): espessura em +Y. */
export const TAMPO_ANGULAR_LAY_FLAT_X_RAD = -Math.PI / 2;

export function serializeTampoAngleForCutlist(
  cfg?: TampoAngleConfig | null
): { frontLengthMm: number; backLengthMm: number; angleDeg: number } | undefined {
  const n = normalizeTampoAngleConfig(cfg);
  if (!n) return undefined;
  return {
    frontLengthMm: n.frontLengthMm,
    backLengthMm: n.backLengthMm,
    angleDeg: n.angleDeg,
  };
}

/** Envelope para cutouts/união: max(front,back) × 630 */
export function resolveTampoAngleEnvelopeMm(
  cfg: TampoAngleConfig | null | undefined,
  baseLengthMm: number,
  widthMm: number = TAMPO_FIXED_WIDTH_MM
): { lengthMm: number; widthMm: number } {
  const n = normalizeTampoAngleConfig(cfg, widthMm);
  const W = Math.max(1, Number(widthMm) || TAMPO_FIXED_WIDTH_MM);
  if (!n) {
    return { lengthMm: Math.max(1, Number(baseLengthMm) || 600), widthMm: W };
  }
  return {
    lengthMm: Math.max(n.frontLengthMm, n.backLengthMm),
    widthMm: W,
  };
}
