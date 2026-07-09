import type { RemateFaceOffsets, RematePiece, RematePlacementMode } from "./rematePieceTypes";
import { isLRematePiece } from "./remateLGeometry";
import { rotationSnapIndexFromLocalY } from "./remateRotationSnap";

export type RemateIndustrialViewerMetadata = {
  rotationSnapIndex: 0 | 1 | 2 | 3;
  viewerRotationYRad: number;
  faceOffsets?: RemateFaceOffsets;
  followBox: boolean;
  placementMode: RematePlacementMode;
};

/** Face offsets para cutlist/nesting quando L ext/int não persiste faceOffsets (snap de canto). */
export function resolveRemateIndustrialFaceOffsets(remate: RematePiece): RemateFaceOffsets | undefined {
  if (remate.faceOffsets) return remate.faceOffsets;
  if (!isLRematePiece(remate)) return undefined;
  const rotationSnapIndex = rotationSnapIndexFromLocalY(remate.rotation?.yRad ?? 0);
  return {
    offsetAlongNormalMm: 0,
    offsetTangentUMm: 0,
    offsetTangentVMm: 0,
    rotationSnapIndex,
  };
}

/** Metadata de viewer (veio/rotação/followBox) para o pipeline industrial — sem alterar geometria L. */
export function buildRemateIndustrialViewerMetadata(remate: RematePiece): RemateIndustrialViewerMetadata {
  const faceOffsets = resolveRemateIndustrialFaceOffsets(remate);
  const placementMode: RematePlacementMode =
    remate.placementMode ?? (remate.followBox ? "SNAPPED" : "FREE");
  const rotationSnapIndex =
    faceOffsets?.rotationSnapIndex ??
    rotationSnapIndexFromLocalY(remate.rotation?.yRad ?? 0);
  return {
    followBox: remate.followBox,
    placementMode,
    faceOffsets,
    rotationSnapIndex,
    viewerRotationYRad: remate.rotation?.yRad ?? 0,
  };
}

export function readRotationSnapIndexFromMetadata(
  metadata?: Record<string, unknown>
): 0 | 1 | 2 | 3 | undefined {
  if (!metadata) return undefined;
  const direct = metadata.rotationSnapIndex;
  if (direct === 0 || direct === 1 || direct === 2 || direct === 3) return direct;
  const faceOffsets = metadata.faceOffsets as RemateFaceOffsets | undefined;
  const fromFace = faceOffsets?.rotationSnapIndex;
  if (fromFace === 0 || fromFace === 1 || fromFace === 2 || fromFace === 3) return fromFace;
  return undefined;
}

/** Converte índice de snap do viewer para rotação V3 (0/90/180/270). */
export function rotationSnapIndexToV3Rotation(
  rotationSnapIndex?: number
): 0 | 90 | 180 | 270 {
  const idx = ((Math.round(rotationSnapIndex ?? 0) % 4) + 4) % 4;
  if (idx === 1) return 90;
  if (idx === 2) return 180;
  if (idx === 3) return 270;
  return 0;
}
