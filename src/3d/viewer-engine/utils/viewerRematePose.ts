import type { RematePiece } from "../../../core/remate/rematePieceTypes";

/** Remate com followBox deve renderizar em SNAPPED quando há faceOffsets. */
export function effectiveRemateForViewerPose(piece: RematePiece): RematePiece {
  if (!piece.followBox) return piece;
  if (piece.placementMode === "SNAPPED" && piece.faceOffsets) return piece;
  if (piece.faceOffsets) {
    return { ...piece, placementMode: "SNAPPED" };
  }
  return piece;
}

export function resolveViewerRematePlacementMode(
  piece: RematePiece | undefined,
  fallback: "SNAPPED" | "FREE" = "FREE"
): "SNAPPED" | "FREE" {
  if (!piece) return fallback;
  if (piece.followBox && piece.faceOffsets) return "SNAPPED";
  if (piece.placementMode === "SNAPPED") return "SNAPPED";
  return piece.placementMode ?? fallback;
}
