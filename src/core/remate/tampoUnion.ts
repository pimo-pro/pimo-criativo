/**
 * TAMPO Fase 4 — união entre tampos (A recebe encaixe; B entra 5–10 mm).
 * Não altera dimensões nem recortes. Só metadata + geometria no receptor A.
 */

import type { RematePiece } from "./rematePieceTypes";

export type TampoUnionDirection = "LEFT" | "RIGHT" | "FRONT" | "BACK";

export type TampoUnion = {
  id: string;
  overlapMm: number;
  targetTampoId: string;
  direction: TampoUnionDirection;
};

export type TampoUnionValidation = {
  ok: boolean;
  errors: string[];
};

export type TampoUnionCutlistEntry = {
  overlapMm: number;
  direction: TampoUnionDirection;
  target: string;
};

export const TAMPO_UNION_OVERLAP_DEFAULT_MM = 8;
export const TAMPO_UNION_OVERLAP_MIN_MM = 5;
export const TAMPO_UNION_OVERLAP_MAX_MM = 10;

export const TAMPO_UNION_DIRECTIONS: TampoUnionDirection[] = [
  "LEFT",
  "RIGHT",
  "FRONT",
  "BACK",
];

export const TAMPO_UNION_DIRECTION_LABELS: Record<TampoUnionDirection, string> = {
  LEFT: "Esquerda",
  RIGHT: "Direita",
  FRONT: "Frente",
  BACK: "Trás",
};

let unionSeq = 0;

export function createTampoUnionId(prefix = "tampo-union"): string {
  unionSeq += 1;
  return `${prefix}-${Date.now()}-${unionSeq}`;
}

export function isTampoPieceForUnion(
  piece: Pick<RematePiece, "productType" | "tipo"> | null | undefined
): boolean {
  if (!piece) return false;
  return piece.tipo === "TAMPO" || piece.productType === "TAMPO_COZINHA";
}

export function normalizeTampoUnion(union: TampoUnion): TampoUnion {
  const overlap = Number(union.overlapMm);
  return {
    id: union.id || createTampoUnionId(),
    targetTampoId: String(union.targetTampoId || "").trim(),
    direction: TAMPO_UNION_DIRECTIONS.includes(union.direction)
      ? union.direction
      : "LEFT",
    overlapMm: Number.isFinite(overlap) ? overlap : TAMPO_UNION_OVERLAP_DEFAULT_MM,
  };
}

export function createTampoUnion(
  partial: Partial<Omit<TampoUnion, "id">> & Pick<TampoUnion, "targetTampoId" | "direction">
): TampoUnion {
  return normalizeTampoUnion({
    id: createTampoUnionId(),
    overlapMm: TAMPO_UNION_OVERLAP_DEFAULT_MM,
    ...partial,
  });
}

/**
 * Valida união no tampo A (host).
 * @param target — tampo B, ou null se inexistente
 */
export function validateTampoUnion(
  union: TampoUnion | null | undefined,
  host: Pick<RematePiece, "id" | "productType" | "tipo">,
  target: Pick<RematePiece, "id" | "productType" | "tipo"> | null
): TampoUnionValidation {
  if (union == null) return { ok: true, errors: [] };

  const errors: string[] = [];
  const u = normalizeTampoUnion(union);

  if (!isTampoPieceForUnion(host)) {
    errors.push("União: o tampo receptor deve ser TAMPO_COZINHA.");
  }
  if (!u.targetTampoId) {
    errors.push("União: seleccione o tampo alvo.");
  } else if (!target) {
    errors.push("União: tampo alvo inexistente.");
  } else {
    if (!isTampoPieceForUnion(target)) {
      errors.push("União: o tampo alvo deve ser TAMPO_COZINHA.");
    }
    if (target.id === host.id) {
      errors.push("União: o tampo alvo não pode ser o próprio receptor.");
    }
  }

  if (
    !Number.isFinite(u.overlapMm) ||
    u.overlapMm < TAMPO_UNION_OVERLAP_MIN_MM ||
    u.overlapMm > TAMPO_UNION_OVERLAP_MAX_MM
  ) {
    errors.push(
      `União: overlap deve estar entre ${TAMPO_UNION_OVERLAP_MIN_MM} e ${TAMPO_UNION_OVERLAP_MAX_MM} mm (recebido ${u.overlapMm} mm).`
    );
  }

  if (!TAMPO_UNION_DIRECTIONS.includes(u.direction)) {
    errors.push("União: direcção inválida (LEFT | RIGHT | FRONT | BACK).");
  }

  return { ok: errors.length === 0, errors };
}

export function serializeTampoUnionForCutlist(
  union?: TampoUnion | null
): TampoUnionCutlistEntry | undefined {
  if (!union) return undefined;
  const u = normalizeTampoUnion(union);
  return {
    overlapMm: u.overlapMm,
    direction: u.direction,
    target: u.targetTampoId,
  };
}
