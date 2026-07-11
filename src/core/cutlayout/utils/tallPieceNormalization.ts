/**
 * Normalização de painéis verticais "altos" (altura > largura) para orientação paisagem
 * antes do nesting/CNC.
 *
 * Ex.: lateral 80×200 (prof×altura) → 200×80 com furos rodados 90° CCW no referencial local.
 * Convenção alinhada a rotateDrillHoles90CCW / holeLocalToSheetOffsetMm.
 */

import { rotateDrillHoles90CCW } from "./cutLayoutGeomRotation";

type HoleLike = {
  x: number;
  y: number;
  diameter?: number;
  depth?: number;
  holeType?: string;
  topDrillable?: boolean;
  rotation?: number;
  rotacao?: number;
  angle?: number;
};

/** Tipos cujo par largura×altura segue profundidade×altura do módulo (painéis verticais). */
const TALL_LANDSCAPE_TIPOS = new Set([
  "lateral",
  "lateral_esquerda",
  "lateral_direita",
  "gaveta_lat_esq",
  "gaveta_lat_dir",
  "gaveta_traseira",
]);

export function shouldNormalizeTallPieceToLandscape(
  pieceTipo: string | undefined,
  larguraMm: number,
  alturaMm: number,
  options?: { lockWoodGrain?: boolean }
): boolean {
  if (!(alturaMm > larguraMm)) return false;
  if (options?.lockWoodGrain === true) return false;
  const token = String(pieceTipo ?? "").trim().toLowerCase();
  return TALL_LANDSCAPE_TIPOS.has(token);
}

export type TallPieceNormalizationResult = {
  larguraMm: number;
  alturaMm: number;
  holes: HoleLike[] | undefined;
  normalized: boolean;
};

/**
 * Troca largura↔altura e roda furos 90° CCW no referencial de desenho original.
 */
export function normalizeTallPieceToLandscape(
  larguraMm: number,
  alturaMm: number,
  holes: HoleLike[] | undefined,
  pieceTipo: string | undefined,
  options?: { lockWoodGrain?: boolean }
): TallPieceNormalizationResult {
  if (!shouldNormalizeTallPieceToLandscape(pieceTipo, larguraMm, alturaMm, options)) {
    return { larguraMm, alturaMm, holes, normalized: false };
  }

  const origW = larguraMm;
  const rotatedHoles =
    holes?.length && holes.length > 0
      ? rotateDrillHoles90CCW(holes as Parameters<typeof rotateDrillHoles90CCW>[0], origW)
      : holes;

  return {
    larguraMm: alturaMm,
    alturaMm: origW,
    holes: rotatedHoles,
    normalized: true,
  };
}
