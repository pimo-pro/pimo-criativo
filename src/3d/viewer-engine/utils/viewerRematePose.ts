import type {
  RemateFaceOffsets,
  RematePiece,
  RematePiecePosition,
  RematePieceRotation,
} from "../../../core/remate/rematePieceTypes";

/** Remate com followBox deve renderizar em SNAPPED quando há faceOffsets. */
export function effectiveRemateForViewerPose(piece: RematePiece): RematePiece {
  if (piece.placementMode === "FREE") return piece;
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

/** Patch mínimo após gizmo: movimento manual → FREE; não reescreve followBox/faceOffsets. */
export function buildViewerRemateTransformPatch(
  tool: string,
  payload: {
    position?: RematePiecePosition;
    rotation?: RematePieceRotation;
    width?: number;
    height?: number;
    depth?: number;
    faceOffsets?: RemateFaceOffsets;
  }
): Partial<RematePiece> {
  if (tool === "scale") {
    return {
      width: payload.width,
      height: payload.height,
      depth: payload.depth,
    };
  }

  const patch: Partial<RematePiece> = {};
  if (payload.position) patch.position = payload.position;
  if (payload.rotation) patch.rotation = payload.rotation;

  if (tool === "translate") {
    patch.placementMode = "FREE";
    return patch;
  }

  if (tool === "rotate" && payload.faceOffsets) {
    patch.faceOffsets = payload.faceOffsets;
  }

  return patch;
}
