import type { ProjectState } from "../../context/projectTypes";
import { buildCutlistItemsForIndustrialExport } from "../../core/fabrication/buildCutlistItemsForIndustrialExport";
import { cutlistToPieces } from "../../core/cutlayout/cutLayoutEngine";
import { cutPieceToV3 } from "../useNestingV3";
import type { V3Piece } from "../nestingV3Types";
import { resolveAllowPieceRotationFromProject } from "./resolveAllowPieceRotation";
import {
  resolveLockWoodGrainFromProject,
  resolveRotationSnapIndexFromProject,
} from "./resolveLockWoodGrain";

export function convertProjectToV3Pieces(project: ProjectState): V3Piece[] {
  if (!project.boxes || project.boxes.length === 0) return [];

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

  return cutPieces.map((piece, index) =>
    cutPieceToV3(piece, index, {
      allowPieceRotation: resolveAllowPieceRotationFromProject(project, piece),
      lockWoodGrain: resolveLockWoodGrainFromProject(project, piece),
      rotationSnapIndex: resolveRotationSnapIndexFromProject(project, piece),
    })
  );
}
