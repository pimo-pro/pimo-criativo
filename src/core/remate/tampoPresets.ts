/**
 * Modelos TAMPO pré-definidos (frente/trás com ângulo).
 * Usáveis em qualquer projecto via createRemateInputFromTampoPreset.
 */

import type { CreateRematePieceInput } from "./rematePieceTypes";
import type { TampoAngleConfig } from "./tampoAngle";
import { computeTampoAngleDegFromLengths, normalizeTampoAngleConfig } from "./tampoAngle";
import {
  TAMPO_COZINHA_PRODUCT,
  TAMPO_FIXED_WIDTH_MM,
  TAMPO_MATERIAL_ID,
  TAMPO_THICKNESS_MM,
} from "./tampoCozinhaRules";

export type TampoPresetId = "tampo1" | "tampo2";

export type TampoPresetDef = {
  id: TampoPresetId;
  label: string;
  productType: typeof TAMPO_COZINHA_PRODUCT;
  width: number;
  height: number;
  depth: number;
  materialPresetId: string;
  angleConfig: TampoAngleConfig;
};

function buildAngle(front: number, back: number): TampoAngleConfig {
  return {
    frontLengthMm: front,
    backLengthMm: back,
    angleDeg: Number(computeTampoAngleDegFromLengths(front, back).toFixed(1)),
  };
}

export const TAMPO_PRESET_1: TampoPresetDef = {
  id: "tampo1",
  label: "Tampo 1 — 1995→2303 mm",
  productType: TAMPO_COZINHA_PRODUCT,
  width: 1995,
  height: TAMPO_FIXED_WIDTH_MM,
  depth: TAMPO_THICKNESS_MM,
  materialPresetId: TAMPO_MATERIAL_ID,
  angleConfig: buildAngle(1995, 2303),
};

export const TAMPO_PRESET_2: TampoPresetDef = {
  id: "tampo2",
  label: "Tampo 2 — 1633→1818 mm",
  productType: TAMPO_COZINHA_PRODUCT,
  width: 1633,
  height: TAMPO_FIXED_WIDTH_MM,
  depth: TAMPO_THICKNESS_MM,
  materialPresetId: TAMPO_MATERIAL_ID,
  angleConfig: buildAngle(1633, 1818),
};

export const TAMPO_PRESETS: readonly TampoPresetDef[] = [TAMPO_PRESET_1, TAMPO_PRESET_2];

export function getTampoPreset(id: TampoPresetId): TampoPresetDef {
  const found = TAMPO_PRESETS.find((p) => p.id === id);
  if (!found) throw new Error(`Preset TAMPO desconhecido: ${id}`);
  return found;
}

/** Input pronto para createRematePiece / createStandaloneRematePiece. */
export function createRemateInputFromTampoPreset(
  id: TampoPresetId,
  opts?: { parentBoxId?: string; followBox?: boolean }
): CreateRematePieceInput {
  const p = getTampoPreset(id);
  const angleConfig = normalizeTampoAngleConfig(p.angleConfig, p.height);
  return {
    productType: p.productType,
    mountSlot: "CIMA",
    width: p.width,
    height: p.height,
    depth: p.depth,
    materialPresetId: p.materialPresetId,
    angleConfig,
    parentBoxId: opts?.parentBoxId,
    followBox: opts?.followBox ?? Boolean(opts?.parentBoxId),
  };
}
