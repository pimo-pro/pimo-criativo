/**
 * Bloqueio de rotação no nesting por material de madeira (veio).
 * Não altera cutlist / TCN / TXML — apenas decisões de layout Nesting V3.
 *
 * Contrato industrial (comportamento definitivo do pipeline):
 * 1. cutlistToPieces — shouldPreserveDesignDimensions: madeira/remate/YY mantém L×A do Viewer (sempre)
 * 2. pairPacking — dimensões reais quando !isRotatablePiece; sem merge que inverta L↔A
 * 3. runCutLayout — isNestingRotationLocked → isRotatablePiece; rotação 0° por defeito; allowPieceRotation true desbloqueia
 *
 * Regressão: src/core/cutlayout/cutlistToPiecesGrain.test.ts
 */

import { getMaterialByIdOrLabel } from "./service";
import { resolveMaterial } from "./materials.api";
import {
  industrialGrainToLayoutAxis,
  isGrainRotationLocked,
} from "./grainDirection";
import type { IndustrialGrainCode } from "../types";

export type NestingGrainLockInput = {
  materialId?: string;
  industrialGrainCode?: IndustrialGrainCode;
  pieceTipo?: string;
  /** false/undefined = veio fixo; true = utilizador activou rotação do veio (único desbloqueio em madeira/YY). */
  allowPieceRotation?: boolean;
  /** true = proibir rotação no nesting (veio fixo). Auto-activo para material de madeira. */
  lockWoodGrain?: boolean;
  /** Remates: nunca reordenar L×A no cutlistToPieces. */
  isRemate?: boolean;
};

/** Lê materialMadeira do CRUD (com inferência em applyInferredIndustrialFields). */
export function isMaterialMadeira(materialId?: string): boolean {
  if (!materialId?.trim()) return false;
  const key = materialId.trim();
  const mat = getMaterialByIdOrLabel(key);
  if (mat?.materialMadeira === true) return true;
  if (mat?.materialMadeira === false) return false;
  if (mat) return inferMaterialMadeiraFromRecord(mat);
  const official = resolveMaterial(key);
  if (official) {
    return inferMaterialMadeiraFromRecord({ label: official.label });
  }
  return inferMaterialMadeiraFromRecord({ label: key });
}

/** Inferência inicial quando o campo ainda não foi gravado no CRUD. */
export function inferMaterialMadeiraFromRecord(input: {
  materialMadeira?: boolean;
  categoryId?: string;
  label?: string;
  visualPresetId?: string;
}): boolean {
  if (input.materialMadeira === true) return true;
  if (input.materialMadeira === false) return false;
  const cat = String(input.categoryId ?? "").toLowerCase();
  if (cat === "carvalho") return true;
  if (cat === "mdf" || cat === "lacado") return false;
  const label = String(input.label ?? "").toLowerCase();
  if (/carvalho|nogueira|madeira|pinho|freijo|wenge|oliveira/.test(label)) return true;
  if (/mdf|branco|lacado|melamina|formica/.test(label)) return false;
  const preset = String(input.visualPresetId ?? "").toLowerCase();
  if (/madeira|carvalho|pinho|wood/.test(preset)) return true;
  return false;
}

/** Bloqueio efectivo de veio (madeira ou toggle explícito). */
export function isWoodGrainLockActive(input: NestingGrainLockInput): boolean {
  if (input.lockWoodGrain === true) return true;
  if (isMaterialMadeira(input.materialId)) return true;
  return false;
}

/**
 * Nunca reordenar L×A (swap largura↔altura) — independente de permitir rotação 90° no nesting.
 * Madeira, YY, remate e lockWoodGrain mantêm dimensões do Viewer/cutlist.
 */
export function shouldPreserveDesignDimensions(input: NestingGrainLockInput): boolean {
  if (input.isRemate) return true;
  if (isMaterialMadeira(input.materialId)) return true;
  if (input.lockWoodGrain === true) return true;
  if (isGrainRotationLocked(input.industrialGrainCode)) return true;
  return false;
}

/**
 * true → nesting não pode rodar a peça (0° apenas).
 * allowPieceRotation === true é o único desbloqueio em madeira/YY (botão "Rotação do veio").
 */
export function isNestingRotationLocked(input: NestingGrainLockInput): boolean {
  if (input.allowPieceRotation === true) return false;
  if (input.allowPieceRotation === false) return true;
  if (input.lockWoodGrain === true) return true;
  if (isMaterialMadeira(input.materialId)) return true;
  if (isGrainRotationLocked(input.industrialGrainCode)) return true;
  return false;
}

/**
 * Orientação do veio no Viewer (face frontal).
 * horizontal = fibra ao longo de X; vertical = fibra ao longo de Y.
 */
export function resolveViewerGrainDirectionForPiece(input: {
  pieceTipo?: string;
  materialId?: string;
  allowPieceRotation?: boolean;
  industrialGrainCode?: IndustrialGrainCode;
}): "horizontal" | "vertical" | "none" {
  if (!isMaterialMadeira(input.materialId)) return "none";
  const code = input.industrialGrainCode;
  if (code !== "YY" && !isGrainRotationLocked(code)) return "none";
  const axis =
    code === "YY" && input.pieceTipo
      ? industrialGrainToLayoutAxis("YY", input.pieceTipo)
      : "width";
  let direction: "horizontal" | "vertical" = axis === "length" ? "horizontal" : "vertical";
  if (input.allowPieceRotation === true) {
    direction = direction === "horizontal" ? "vertical" : "horizontal";
  }
  return direction;
}

/**
 * grainDirection de layout usado só no pipeline Nesting V3 (v3ToCutPieces).
 * Bloqueia rotação no motor sem alterar industrialGrainCode da cutlist.
 */
export function resolveNestingLayoutGrainDirection(
  input: NestingGrainLockInput
): "length" | "width" | undefined {
  if (!isNestingRotationLocked(input)) return undefined;
  if (input.industrialGrainCode === "YY" && input.pieceTipo) {
    return industrialGrainToLayoutAxis("YY", input.pieceTipo);
  }
  return "length";
}

/** Índice de snap 1 ou 3 → peça “virada” 90°/270° no viewer (veio invertido). */
export function isViewerGrainFlipped(rotationSnapIndex?: number): boolean {
  return rotationSnapIndex === 1 || rotationSnapIndex === 3;
}

/**
 * Escala UV para viewer: material com veio + peça virada inverte orientação.
 * Quando rotação está bloqueada, mantém veio canónico (horizontal = fibra ao longo de X).
 */
export function resolveViewerGrainUvScale(
  base: { x: number; y: number },
  options: {
    materialMadeira?: boolean;
    grainFlipped?: boolean;
    grainDirection?: "horizontal" | "vertical" | "none";
  }
): { x: number; y: number } {
  const madeira = options.materialMadeira === true;
  const g = options.grainDirection;
  let scale = { ...base };
  if (g === "horizontal") scale = { x: 2, y: 1 };
  else if (g === "vertical") scale = { x: 1, y: 2 };
  if (madeira && options.grainFlipped) {
    return { x: scale.y, y: scale.x };
  }
  return scale;
}
