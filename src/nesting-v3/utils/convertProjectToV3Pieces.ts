import type { ProjectState } from "../../context/projectTypes";
import { buildCutlistItemsForIndustrialExport } from "../../core/fabrication/buildCutlistItemsForIndustrialExport";
import { cutlistToPieces } from "../../core/cutlayout/cutLayoutEngine";
import { ensureIndustrialDrillingSsotFresh } from "../../core/manufacturing/drillingSsotCache";
import { cutPieceToV3 } from "../useNestingV3";
import type { V3Piece } from "../nestingV3Types";
import { traceHolePipeline } from "../../core/cutlayout/utils/holeGeomInvariant";
import { resolveAllowPieceRotationFromProject } from "./resolveAllowPieceRotation";
import {
  resolveLockWoodGrainFromProject,
  resolveRotationSnapIndexFromProject,
} from "./resolveLockWoodGrain";

export function convertProjectToV3Pieces(project: ProjectState): V3Piece[] {
  if (!project.boxes || project.boxes.length === 0) return [];

  ensureIndustrialDrillingSsotFresh();
  const allItems = buildCutlistItemsForIndustrialExport({
    boxes: project.boxes,
    rules: project.rules,
    materialId: project.materialId,
    projectName: project.projectName ?? "Projeto",
    remates: project.remates ?? [],
    rodapes: project.rodapes ?? [],
    extractedPartsByBoxId: project.extractedPartsByBoxId,
  });

  const cutPieces = cutlistToPieces(allItems, {
    projectName: project.projectName ?? "Projeto",
    boxes: project.boxes,
  });

  return cutPieces.map((piece, index) => {
    const v3 = cutPieceToV3(piece, index, {
      allowPieceRotation: resolveAllowPieceRotationFromProject(project, piece),
      lockWoodGrain: resolveLockWoodGrainFromProject(project, piece),
      rotationSnapIndex: resolveRotationSnapIndexFromProject(project, piece),
    });
    if (v3.originalHoles.length > 0) {
      traceHolePipeline({
        stage: "C_convertProjectToV3",
        pieceId: v3.id,
        width: v3.widthMm,
        height: v3.heightMm,
        rotation: v3.rotation,
        holes: v3.originalHoles.map((h) => ({
          xLocal: h.x,
          yLocal: h.y,
          tipo: h.holeType,
        })),
        flags: { dimensionsSwapped: false, implicitRotation: false, holesTransformed: false },
      });
    }
    return v3;
  });
}
