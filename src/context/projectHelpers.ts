/**
 * Helpers de projeto: geometria, spawn, identificação de caixas.
 * Usado por ProjectProvider e useProjectActions.
 */

import type { WorkspaceBox } from "../core/types";
import type { ProjectState } from "./projectTypes";

export const UPPER_FLOOR_DEFAULT_MM = 1500;
export const UPPER_STANDARD_GAP_MM = 680;
export const UPPER_COUNTERTOP_MM = 0;

export function isLowerCabinet(box: WorkspaceBox): boolean {
  return box.cabinetType === "lower" || (box.cabinetType == null && box.feetEnabled !== false);
}

export function isUpperCabinet(box: WorkspaceBox): boolean {
  return box.cabinetType === "upper";
}

export function getBoxLeftMm(box: WorkspaceBox): number {
  return (box.posicaoX_mm ?? 0) - (box.dimensoes?.largura ?? 0) / 2;
}

export function getBoxRightMm(box: WorkspaceBox): number {
  return (box.posicaoX_mm ?? 0) + (box.dimensoes?.largura ?? 0) / 2;
}

export function getBoxTopMm(box: WorkspaceBox): number {
  return (box.posicaoY_mm ?? 0) + (box.dimensoes?.altura ?? 0) / 2;
}

export function getNextWorkspaceBoxId(
  workspaceBoxes: WorkspaceBox[],
  preferredIndex?: number
): { id: string; index: number } {
  const nextIndex =
    preferredIndex !== undefined && Number.isFinite(preferredIndex)
      ? preferredIndex
      : workspaceBoxes.length + 1;
  const id = `box-${nextIndex}-${Date.now()}`;
  return { id, index: nextIndex };
}

const NEW_BOX_GAP_MM = 0;

export function getAdjacentPlacementMm(
  referenceBox: WorkspaceBox,
  targetDimensions: { largura: number },
  gapMm = NEW_BOX_GAP_MM
): { x_mm: number; z_mm: number } {
  const referenceWidthMm = Math.max(0, referenceBox.dimensoes?.largura ?? 0);
  const targetWidthMm = Math.max(0, targetDimensions.largura ?? 0);
  const distanceMm = referenceWidthMm / 2 + targetWidthMm / 2 + Math.max(0, gapMm);
  const rotationY = Number.isFinite(referenceBox.rotacaoY) ? (referenceBox.rotacaoY ?? 0) : 0;
  const dirX = Math.cos(rotationY);
  const dirZ = Math.sin(rotationY);
  return {
    x_mm: (referenceBox.posicaoX_mm ?? 0) + dirX * distanceMm,
    z_mm: (referenceBox.posicaoZ_mm ?? 0) + dirZ * distanceMm,
  };
}

export function getSelectedOrFirstWorkspaceBox(prev: ProjectState): WorkspaceBox | null {
  const list = prev.workspaceBoxes ?? [];
  const selected = list.find((b) => b.id === prev.selectedWorkspaceBoxId);
  return selected ?? list[0] ?? null;
}
