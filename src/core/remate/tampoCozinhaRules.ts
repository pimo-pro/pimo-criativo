import {
  MDB_LAMINADO_CANONICAL_ID,
  MDB_LAMINADO_MAX_PIECE_WIDTH_MM,
  MDB_LAMINADO_SHEET_LF_MM,
  resolveMaterial,
  validateMaterialPieceWidthMm,
} from "../materials/materials.api";
import type { RematePiece, RemateProductType } from "./rematePieceTypes";

export const TAMPO_COZINHA_PRODUCT: RemateProductType = "TAMPO_COZINHA";
export const TAMPO_FIXED_WIDTH_MM = MDB_LAMINADO_MAX_PIECE_WIDTH_MM; // 630
export const TAMPO_MAX_LENGTH_MM = MDB_LAMINADO_SHEET_LF_MM; // 3660
export const TAMPO_MATERIAL_ID = MDB_LAMINADO_CANONICAL_ID; // mdb_laminado-30
export const TAMPO_THICKNESS_MM = 30;

export type TampoValidation = {
  ok: boolean;
  errors: string[];
};

export function isTampoCozinhaProduct(productType?: string | null): boolean {
  return productType === "TAMPO_COZINHA";
}

export function isTampoCozinhaMaterial(materialIdOrAlias: string): boolean {
  const mat = resolveMaterial(materialIdOrAlias);
  return (
    mat?.productMeta?.productType === "tampo_cozinha" ||
    mat?.canonicalId === MDB_LAMINADO_CANONICAL_ID
  );
}

/** Marcar como tampo OU escolher matéria MDB → regras TAMPO. */
export function shouldApplyTampoRules(input: {
  productType?: string | null;
  materialPresetId?: string | null;
}): boolean {
  if (isTampoCozinhaProduct(input.productType)) return true;
  if (input.materialPresetId && isTampoCozinhaMaterial(input.materialPresetId)) return true;
  return false;
}

export function computeTampoDimensions(opts: {
  boxLarguraMm?: number | null;
  lengthMm?: number | null;
}): { width: number; height: number; depth: number } {
  const rawLength = Number(opts.lengthMm);
  const fromBox = Number(opts.boxLarguraMm);
  const length = Math.max(
    1,
    Number.isFinite(rawLength) && rawLength > 0
      ? rawLength
      : Number.isFinite(fromBox) && fromBox > 0
        ? fromBox
        : 600
  );
  return {
    width: Math.min(length, TAMPO_MAX_LENGTH_MM),
    height: TAMPO_FIXED_WIDTH_MM,
    depth: TAMPO_THICKNESS_MM,
  };
}

export function applyTampoIndustrialDefaults<T extends Partial<RematePiece>>(piece: T): T & {
  productType: RemateProductType;
  tipo: "TAMPO";
  materialPresetId: string;
  width: number;
  height: number;
  depth: number;
} {
  const dims = computeTampoDimensions({
    lengthMm: piece.width,
    boxLarguraMm: piece.width,
  });
  return {
    ...piece,
    productType: TAMPO_COZINHA_PRODUCT,
    tipo: "TAMPO",
    mountSlot: piece.mountSlot ?? "CIMA",
    materialPresetId: TAMPO_MATERIAL_ID,
    width: dims.width,
    height: TAMPO_FIXED_WIDTH_MM,
    depth: TAMPO_THICKNESS_MM,
  };
}

export function validateTampoIndustrial(input: {
  widthMm: number;
  heightMm: number;
  materialPresetId?: string;
}): TampoValidation {
  const errors: string[] = [];
  const length = Number(input.widthMm) || 0;
  const width = Number(input.heightMm) || 0;

  if (width > TAMPO_FIXED_WIDTH_MM) {
    errors.push(`TAMPO: largura máxima ${TAMPO_FIXED_WIDTH_MM} mm (recebido ${width} mm).`);
  }
  const widthCheck = validateMaterialPieceWidthMm(
    input.materialPresetId ?? TAMPO_MATERIAL_ID,
    width
  );
  if (!widthCheck.ok && widthCheck.message) errors.push(widthCheck.message);

  if (length > TAMPO_MAX_LENGTH_MM) {
    errors.push(`TAMPO: comprimento máximo ${TAMPO_MAX_LENGTH_MM} mm (recebido ${length} mm).`);
  }
  if (length <= 0) errors.push("TAMPO: comprimento deve ser > 0.");

  return { ok: errors.length === 0, errors };
}
