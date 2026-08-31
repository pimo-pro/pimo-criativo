/**
 * CutLayoutResult → NestingV3State (placements TL + rotações).
 */

import type { CutLayoutResult, CutPlacement } from "../cutLayoutTypes";
import type { NestingV3State, V3Piece, V3Placement, V3Sheet } from "../../../nesting-v3/nestingV3Types";
import { cutPlacementToV3Placement } from "./layoutCoordinateAdapter";

const FOOTPRINT_TOL_MM = 0.5;

function normalizeV3Rotation(rotacao: number): 0 | 90 | 180 | 270 {
  const r = ((Math.round(rotacao) % 360) + 360) % 360;
  if (r === 90) return 90;
  if (r === 180) return 180;
  if (r === 270) return 270;
  return 0;
}

function approxMm(a: number, b: number): boolean {
  return Math.abs(a - b) <= FOOTPRINT_TOL_MM;
}

/**
 * CutLayout por vezes grava footprint L×A já trocado com rotacao=0
 * (ex. gav_lat_*). Sem isto o V3 desenha/exporta effectiveDims errados.
 *
 * - match (L×A ≈ w×h): confia em rotacao do layout
 * - swapped (L×A ≈ h×w) + rot 0/180 → 90/270
 * - swapped + rot já 90/270: mantém (não dupla-aplica)
 */
export function inferV3RotationFromFootprint(
  pl: Pick<CutPlacement, "largura_mm" | "altura_mm" | "rotacao">,
  piece: Pick<V3Piece, "widthMm" | "heightMm">
): 0 | 90 | 180 | 270 {
  const fromLayout = normalizeV3Rotation(pl.rotacao);
  const { widthMm: w, heightMm: h } = piece;
  const L = pl.largura_mm;
  const A = pl.altura_mm;
  const match = approxMm(L, w) && approxMm(A, h);
  const swapped = approxMm(L, h) && approxMm(A, w);
  if (match) return fromLayout;
  if (swapped) {
    if (fromLayout === 0) return 90;
    if (fromLayout === 180) return 270;
    return fromLayout;
  }
  return fromLayout;
}

function resolveV3PieceId(pl: CutPlacement, pieces: V3Piece[]): string | null {
  const fromMeta = pl.metadata?.v3PieceId;
  if (typeof fromMeta === "string" && fromMeta.length > 0) return fromMeta;
  const match = pieces.find(
    (p) => p.name === pl.partName && (p.sourceBoxId ?? p.id) === pl.boxId
  );
  return match?.id ?? null;
}

export function cutLayoutResultToV3State(result: CutLayoutResult, baseState: NestingV3State): NestingV3State {
  const piecesById = new Map(baseState.pieces.map((p) => [p.id, { ...p }]));
  const placedIds = new Set<string>();
  const placements: V3Placement[] = [];

  const sheets: V3Sheet[] = result.sheets.map((sr, index) => ({
    index,
    widthMm: sr.sheet.largura_mm,
    heightMm: sr.sheet.altura_mm,
    thicknessMm: sr.sheet.espessura_mm,
    materialId: sr.sheet.materialId,
    materialName: sr.sheet.materialName,
  }));

  result.sheets.forEach((sr, sheetIndex) => {
    const sheetHeight = sr.sheet.altura_mm;
    for (const pl of sr.placements) {
      const pieceId = resolveV3PieceId(pl, baseState.pieces);
      if (!pieceId) continue;

      const pieceForInfer =
        piecesById.get(pieceId) ?? baseState.pieces.find((p) => p.id === pieceId);
      const rotation = pieceForInfer
        ? inferV3RotationFromFootprint(pl, pieceForInfer)
        : normalizeV3Rotation(pl.rotacao);

      const v3Pl = cutPlacementToV3Placement(
        { ...pl, sheetIndex, metadata: { ...pl.metadata, v3PieceId: pieceId } },
        sheetHeight
      );
      placements.push({
        ...v3Pl,
        pieceId,
        sheetIndex,
        rotated: rotation === 90 || rotation === 270,
      });

      const piece = piecesById.get(pieceId);
      if (piece) {
        piece.rotation = rotation;
        placedIds.add(pieceId);
      }
    }
  });

  const unplacedPieceIds = baseState.pieces
    .filter((p) => !placedIds.has(p.id))
    .map((p) => p.id);

  return {
    ...baseState,
    sheets: sheets.length > 0 ? sheets : baseState.sheets,
    pieces: Array.from(piecesById.values()),
    placements,
    unplacedPieceIds,
    activeSheetIndex: Math.min(baseState.activeSheetIndex, Math.max(0, sheets.length - 1)),
  };
}
