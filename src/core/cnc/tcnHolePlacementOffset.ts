import type { CutPlacement } from "../cutlayout/cutLayoutTypes";
import { holeLocalToSheetOffsetMm } from "../cutlayout/layoutCoordinateSystem";
import { resolvePieceDesignDims } from "../cutlayout/utils/holeGeomInvariant";

type TcnPlacementLike = Pick<CutPlacement, "largura_mm" | "altura_mm" | "rotacao" | "metadata">;

export function normalizeTcnRotationDeg(rotacao: number | undefined): number {
  return ((rotacao ?? 0) % 360 + 360) % 360;
}

/**
 * Offset de furo local → placement para export TCN (v2_new / v3_new).
 * Alinhado ao v1 e ao contrato industrial: placement dims + design dims explícitas.
 */
export function tcnHoleLocalToSheetOffsetMm(
  hx: number,
  hy: number,
  pl: TcnPlacementLike
): { sx: number; sy: number } {
  const rot = normalizeTcnRotationDeg(pl.rotacao);
  const { designW, designH } = resolvePieceDesignDims({
    largura_mm: pl.largura_mm,
    altura_mm: pl.altura_mm,
    rotacao: rot,
    metadata: pl.metadata,
  });
  return holeLocalToSheetOffsetMm(hx, hy, rot, pl.largura_mm, pl.altura_mm, designW, designH);
}
