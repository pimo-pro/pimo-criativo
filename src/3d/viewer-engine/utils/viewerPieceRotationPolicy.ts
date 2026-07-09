import {
  isMaterialMadeira,
  isNestingRotationLocked,
} from "../../../core/materials/nestingGrainLock";
import type { RematePiece } from "../../../core/remate/rematePieceTypes";
import type { ProjectRodape } from "../../../core/rodape/rodapeTypes";
import type { IndustrialGrainCode } from "../../../core/types";

/** Viewer: a peça pode ser rodada com gizmo/teclado? */
export function isViewerPieceRotationAllowed(input: {
  materialId?: string;
  allowPieceRotation?: boolean;
  lockWoodGrain?: boolean;
  pieceTipo?: string;
  industrialGrainCode?: IndustrialGrainCode;
}): boolean {
  return !isNestingRotationLocked({
    materialId: input.materialId,
    allowPieceRotation: input.allowPieceRotation,
    lockWoodGrain: input.lockWoodGrain,
    pieceTipo: input.pieceTipo,
    industrialGrainCode: input.industrialGrainCode,
  });
}

export function isViewerRemateRotationAllowed(piece: RematePiece): boolean {
  return isViewerPieceRotationAllowed({
    materialId: piece.materialPresetId,
    allowPieceRotation: piece.allowPieceRotation,
    lockWoodGrain: piece.lockWoodGrain,
    pieceTipo: "remate",
    industrialGrainCode: undefined,
  });
}

export function isViewerDoorRotationAllowed(input: {
  materialId?: string;
  allowPieceRotation?: boolean;
  lockWoodGrain?: boolean;
}): boolean {
  return isViewerPieceRotationAllowed({
    materialId: input.materialId,
    allowPieceRotation: input.allowPieceRotation,
    lockWoodGrain: input.lockWoodGrain,
    pieceTipo: "porta_simples",
    industrialGrainCode: "YY",
  });
}

export function isViewerRodapeRotationAllowed(rodape: ProjectRodape): boolean {
  return isViewerPieceRotationAllowed({
    materialId: rodape.materialId,
    allowPieceRotation: rodape.allowPieceRotation,
    lockWoodGrain: rodape.lockWoodGrain,
    pieceTipo: "rodape",
  });
}

/** Índice de snap para UV do veio (0 quando rotação bloqueada). */
export function resolveViewerGrainSnapIndex(
  rotationSnapIndex: number | undefined,
  materialId: string | undefined,
  lockWoodGrain?: boolean,
  allowPieceRotation?: boolean
): number | undefined {
  if (
    isNestingRotationLocked({
      materialId,
      lockWoodGrain,
      allowPieceRotation,
      industrialGrainCode: "YY",
    })
  ) {
    return 0;
  }
  return rotationSnapIndex;
}

export function isViewerWoodMaterial(materialId?: string): boolean {
  return isMaterialMadeira(materialId);
}
