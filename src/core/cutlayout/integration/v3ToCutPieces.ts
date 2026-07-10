/**
 * V3Piece → CutPiece[] para runCutLayout (Etapa 2).
 *
 * Preserva dimensões, furos e IDs originais; rotação V3 fica em metadata (não altera largura/altura).
 */

import type { CutPiece } from "../cutLayoutTypes";
import type { V3Piece } from "../../../nesting-v3/nestingV3Types";
import type { NestingV3Settings } from "../../../nesting-v3/nestingV3Settings";
import { sheetDimsForMaterial } from "../../../nesting-v3/nestingV3Settings";
import { resolveNestingLayoutGrainDirection } from "../../materials/nestingGrainLock";
import { copyHolesLocalInvariant } from "../utils/holeGeomInvariant";
import { filterHingeHolesLocalBeforeInvariant } from "../../../modules/drilling/hingeOffsetUtils";

function mapGrainDirection(piece: V3Piece): CutPiece["grainDirection"] {
  const nestingLock = resolveNestingLayoutGrainDirection({
    materialId: piece.materialId,
    industrialGrainCode: piece.industrialGrainCode,
    pieceTipo: piece.pieceTipo,
    allowPieceRotation: piece.allowPieceRotation,
    lockWoodGrain: piece.lockWoodGrain,
  });
  if (nestingLock) return nestingLock;
  if (piece.industrialGrainCode === "YY") return "length";
  if (piece.industrialGrainCode === "XX") return "width";
  return undefined;
}

export function v3PiecesToCutPieces(pieces: V3Piece[], settings: NestingV3Settings): CutPiece[] {
  return pieces.map((piece) => {
    const sheetDims = sheetDimsForMaterial(piece.materialId, settings);
    return {
      largura_mm: piece.widthMm,
      altura_mm: piece.heightMm,
      espessura_mm: piece.thicknessMm,
      quantidade: 1,
      boxId: piece.sourceBoxId ?? piece.id,
      partName: piece.name,
      materialId: piece.materialId,
      materialName: piece.materialName,
      drillHoles: copyHolesLocalInvariant(
        filterHingeHolesLocalBeforeInvariant(
          piece.originalHoles.map((h) => ({
            x: h.x,
            y: h.y,
            diameter: h.diameter,
            depth: h.depth,
            holeType: h.holeType,
          })),
          piece.widthMm,
          piece.heightMm,
          "v3ToCutPieces",
          piece.id
        ),
        piece.widthMm,
        piece.heightMm,
        piece.id
      ),
      industrialGrainCode: piece.industrialGrainCode,
      pieceTipo: piece.pieceTipo,
      grainDirection: mapGrainDirection(piece),
      sheetWidthMm: sheetDims.sheetWidthMm,
      sheetHeightMm: sheetDims.sheetHeightMm,
      sheetThicknessMm: sheetDims.sheetThicknessMm,
      metadata: {
        v3PieceId: piece.id,
        v3Rotation: piece.rotation,
        v3SourceBoxId: piece.sourceBoxId,
        v3SourceProjectId: piece.sourceProjectId,
        allowPieceRotation: piece.allowPieceRotation,
        lockWoodGrain: piece.lockWoodGrain,
        remateId: piece.remateId,
        partIndex: piece.partIndex,
        remateKind: piece.remateKind,
        followBox: piece.followBox,
        placementMode: piece.placementMode,
        rotationSnapIndex: piece.rotationSnapIndex,
        faceOffsets: piece.faceOffsets,
        holeDesignLarguraMm: piece.widthMm,
        holeDesignAlturaMm: piece.heightMm,
      },
    };
  });
}
