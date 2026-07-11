/**
 * Fase B (B3) — Pair packing: super-peças virtuais para pares compatíveis.
 *
 * Contrato madeira (veio): peças com !isRotatablePiece usam largura_mm/altura_mm reais
 * (sem max/min landscape). Não formam pares virtuais com peças de rotação bloqueada.
 */

import type { CutPiece } from "../cutLayoutTypes";
import type { PlacementCandidate } from "../scoring/rotationScoring";
import { isRotatablePiece } from "../utils/cutLayoutUtils";

const HEIGHT_TOL_MM = 2;
const NATURAL_PAIR_A = /\b(lateral|lat_|side)\b/i;
const NATURAL_PAIR_B = /\b(prateleira|shelf|pra)\b/i;

export type PairPackMeta = {
  pieceA: CutPiece;
  pieceB: CutPiece;
  wA: number;
  hA: number;
  wB: number;
  hB: number;
};

export const PAIR_PACK_META_KEY = "pairPackVirtual";

export function isPairVirtualPiece(piece: CutPiece): boolean {
  return Boolean(piece.metadata?.[PAIR_PACK_META_KEY]);
}

export function getPairPackMeta(piece: CutPiece): PairPackMeta | null {
  const raw = piece.metadata?.[PAIR_PACK_META_KEY];
  if (!raw || typeof raw !== "object") return null;
  return raw as PairPackMeta;
}

function piecePairHeight(p: CutPiece): number {
  if (!isRotatablePiece(p)) return p.altura_mm;
  return Math.min(p.largura_mm, p.altura_mm);
}

function piecePairWidth(p: CutPiece): number {
  if (!isRotatablePiece(p)) return p.largura_mm;
  return Math.max(p.largura_mm, p.altura_mm);
}

function isNaturalPair(a: CutPiece, b: CutPiece): boolean {
  const na = a.partName ?? "";
  const nb = b.partName ?? "";
  return (
    (NATURAL_PAIR_A.test(na) && NATURAL_PAIR_B.test(nb)) ||
    (NATURAL_PAIR_B.test(na) && NATURAL_PAIR_A.test(nb))
  );
}

function canFormHorizontalPair(a: CutPiece, b: CutPiece, sheetWidth: number, kerf: number): boolean {
  const hA = piecePairHeight(a);
  const hB = piecePairHeight(b);
  if (Math.abs(hA - hB) > HEIGHT_TOL_MM) return false;
  const wA = piecePairWidth(a);
  const wB = piecePairWidth(b);
  return wA + wB + kerf <= sheetWidth;
}

function combinedRotationGuard(a: CutPiece, b: CutPiece): Pick<CutPiece, "drillHoles" | "holes" | "grainDirection" | "industrialGrainCode"> {
  const holes = [
    ...(a.originalDrillHoles ?? a.drillHoles ?? a.holes ?? []),
    ...(b.originalDrillHoles ?? b.drillHoles ?? b.holes ?? []),
  ];
  const grainDirection = a.grainDirection ?? b.grainDirection;
  const industrialGrainCode = a.industrialGrainCode === "YY" || b.industrialGrainCode === "YY"
    ? "YY"
    : (a.industrialGrainCode ?? b.industrialGrainCode);

  return {
    drillHoles: holes.length > 0 ? holes : undefined,
    holes: holes.length > 0 ? holes : undefined,
    grainDirection,
    industrialGrainCode,
  };
}

function buildVirtualPairPiece(a: CutPiece, b: CutPiece, kerf: number): CutPiece {
  const wA = piecePairWidth(a);
  const wB = piecePairWidth(b);
  const h = Math.max(piecePairHeight(a), piecePairHeight(b));
  const meta: PairPackMeta = { pieceA: { ...a }, pieceB: { ...b }, wA, hA: piecePairHeight(a), wB, hB: piecePairHeight(b) };
  return {
    ...a,
    largura_mm: wA + wB + kerf,
    altura_mm: h,
    partName: `${a.partName}+${b.partName}`,
    ...combinedRotationGuard(a, b),
    metadata: { ...a.metadata, [PAIR_PACK_META_KEY]: meta },
  };
}

/**
 * Substitui pares compatíveis na lista por super-peças virtuais (in-place nos índices).
 */
export function applyPairVirtualPieces(remaining: CutPiece[], sheetWidth: number, kerf: number): CutPiece[] {
  const used = new Set<number>();
  const out: CutPiece[] = [];

  for (let i = 0; i < remaining.length; i++) {
    if (used.has(i)) continue;
    const a = remaining[i]!;
    if (isPairVirtualPiece(a)) {
      out.push(a);
      continue;
    }

    let paired = false;
    for (let j = i + 1; j < remaining.length; j++) {
      if (used.has(j)) continue;
      const b = remaining[j]!;
      if (isPairVirtualPiece(b)) continue;
      if (!isRotatablePiece(a) || !isRotatablePiece(b)) continue;
      const compatible =
        canFormHorizontalPair(a, b, sheetWidth, kerf) ||
        (isNaturalPair(a, b) &&
          piecePairWidth(a) + piecePairWidth(b) + kerf <= sheetWidth &&
          Math.abs(piecePairHeight(a) - piecePairHeight(b)) <= HEIGHT_TOL_MM * 4);
      if (!compatible) continue;
      out.push(buildVirtualPairPiece(a, b, kerf));
      used.add(i);
      used.add(j);
      paired = true;
      break;
    }
    if (!paired) out.push(a);
  }
  return out;
}

export type ExpandedPairPlacement = {
  piece: CutPiece;
  placement: PlacementCandidate;
};

type LocalPairRect = {
  piece: CutPiece;
  x: number;
  y: number;
  w: number;
  h: number;
};

function normalizePlacementRotation(rotation: number | undefined): 0 | 90 {
  const r = ((Math.round(rotation ?? 0) % 360) + 360) % 360;
  return r === 90 ? 90 : 0;
}

/** Divide super-peça colocada em duas peças reais lado a lado. */
export function expandPairPlacement(
  virtualPiece: CutPiece,
  placement: PlacementCandidate,
  kerf: number
): ExpandedPairPlacement[] {
  const meta = getPairPackMeta(virtualPiece);
  if (!meta) {
    return [{ piece: virtualPiece, placement }];
  }

  const scaleX = placement.w / virtualPiece.largura_mm;
  const scaleY = placement.h / virtualPiece.altura_mm;
  const wA = meta.wA * scaleX;
  const wB = meta.wB * scaleX;
  const hA = meta.hA * scaleY;
  const hB = meta.hB * scaleY;
  const gap = kerf * scaleX;
  const rotation = normalizePlacementRotation(placement.rotation);

  if (rotation === 0) {
    return [
      {
        piece: meta.pieceA,
        placement: {
          ...placement,
          w: wA,
          h: hA,
          rotation: 0,
        },
      },
      {
        piece: meta.pieceB,
        placement: {
          ...placement,
          x: placement.x + wA + gap,
          w: wB,
          h: hB,
          rotation: 0,
        },
      },
    ];
  }

  const originalVirtualWidth = virtualPiece.largura_mm;
  const sx = placement.h / originalVirtualWidth;
  const sy = placement.w / virtualPiece.altura_mm;
  const rects: LocalPairRect[] = [
    { piece: meta.pieceA, x: 0, y: 0, w: meta.wA, h: meta.hA },
    { piece: meta.pieceB, x: meta.wA + kerf, y: 0, w: meta.wB, h: meta.hB },
  ];

  return rects.map((rect) => ({
    piece: rect.piece,
    placement: {
      ...placement,
      x: placement.x + rect.y * sy,
      y: placement.y + (originalVirtualWidth - rect.x - rect.w) * sx,
      w: rect.h * sy,
      h: rect.w * sx,
      rotation: 90,
    },
  }));
}
