/**
 * CutLayoutResult → NestingV3State (placements TL + rotações).
 */

import type { CutLayoutResult, CutPlacement } from "../cutLayoutTypes";
import type { NestingV3State, V3Piece, V3Placement, V3Sheet } from "../../../nesting-v3/nestingV3Types";
import { cutPlacementToV3Placement } from "./layoutCoordinateAdapter";
import { isNestingRotationLocked } from "../../materials/nestingGrainLock";

function normalizeV3Rotation(rotacao: number): 0 | 90 | 180 | 270 {
  const r = ((Math.round(rotacao) % 360) + 360) % 360;
  if (r === 90) return 90;
  if (r === 180) return 180;
  if (r === 270) return 270;
  return 0;
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

      const v3Pl = cutPlacementToV3Placement(
        { ...pl, sheetIndex, metadata: { ...pl.metadata, v3PieceId: pieceId } },
        sheetHeight
      );
      placements.push({ ...v3Pl, pieceId, sheetIndex });

      const piece = piecesById.get(pieceId);
      if (piece) {
        const locked = isNestingRotationLocked({
          materialId: piece.materialId,
          industrialGrainCode: piece.industrialGrainCode,
          pieceTipo: piece.pieceTipo,
          allowPieceRotation: piece.allowPieceRotation,
          lockWoodGrain: piece.lockWoodGrain,
        });
        if (!locked) {
          piece.rotation = normalizeV3Rotation(pl.rotacao);
        }
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
