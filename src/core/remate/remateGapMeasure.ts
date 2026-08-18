import * as THREE from "three";
import type { BoxModule, WorkspaceBox } from "../types";
import type { RematePiece } from "./rematePieceTypes";
import { getActiveViewerCore } from "../viewer/pimoViewerRuntime";

export type RemateGapResult = {
  gapXMm: number;
  gapYMm: number;
  targetLabel: string;
  overlapping: boolean;
};

type FootprintAabb = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

function axisGap(minA: number, maxA: number, minB: number, maxB: number): number {
  if (maxA <= minB) return minB - maxA;
  if (maxB <= minA) return minA - maxB;
  return 0;
}

function boxWorkspaceFootprint(box: WorkspaceBox): FootprintAabb {
  const x = box.posicaoX_mm ?? 0;
  const y = box.posicaoY_mm ?? 0;
  const w = Math.max(1, box.dimensoes?.largura ?? 600);
  const d = Math.max(1, box.dimensoes?.profundidade ?? 600);
  return { minX: x, maxX: x + w, minY: y, maxY: y + d };
}

function remateStandaloneFootprint(remate: RematePiece): FootprintAabb {
  const cx = remate.position.xMm;
  const cy = remate.position.yMm;
  const hw = Math.max(1, remate.width) / 2;
  const hh = Math.max(1, remate.height) / 2;
  return { minX: cx - hw, maxX: cx + hw, minY: cy - hh, maxY: cy + hh };
}

function tryRemateFootprintFromViewer(remateId: string): FootprintAabb | null {
  const core = getActiveViewerCore();
  const mesh = core?.getRemateMesh?.(remateId) as THREE.Object3D | null | undefined;
  if (!mesh) return null;
  const box3 = new THREE.Box3().setFromObject(mesh);
  if (box3.isEmpty()) return null;
  return {
    minX: box3.min.x * 1000,
    maxX: box3.max.x * 1000,
    minY: box3.min.z * 1000,
    maxY: box3.max.z * 1000,
  };
}

function tryBoxFootprintFromViewer(boxId: string): FootprintAabb | null {
  const core = getActiveViewerCore();
  const matrix = core?.getBoxWorldMatrix?.(boxId);
  const dims = core?.getBoxDimensions?.(boxId);
  if (!matrix || !dims) return null;
  const w = dims.width;
  const d = dims.depth;
  const corners = [
    new THREE.Vector3(-w / 2, 0, -d / 2),
    new THREE.Vector3(w / 2, 0, -d / 2),
    new THREE.Vector3(-w / 2, 0, d / 2),
    new THREE.Vector3(w / 2, 0, d / 2),
  ].map((v) => v.applyMatrix4(matrix));
  const xs = corners.map((c) => c.x * 1000);
  const zs = corners.map((c) => c.z * 1000);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...zs),
    maxY: Math.max(...zs),
  };
}

function measureGapBetween(a: FootprintAabb, b: FootprintAabb): Pick<RemateGapResult, "gapXMm" | "gapYMm" | "overlapping"> {
  const gapX = axisGap(a.minX, a.maxX, b.minX, b.maxX);
  const gapY = axisGap(a.minY, a.maxY, b.minY, b.maxY);
  const overlapping = gapX === 0 && gapY === 0;
  return { gapXMm: Math.round(gapX * 10) / 10, gapYMm: Math.round(gapY * 10) / 10, overlapping };
}

export function measureRemateGapToBox(
  remate: RematePiece,
  box: WorkspaceBox | BoxModule | null | undefined
): RemateGapResult | null {
  if (!box) return null;
  const remateFp = tryRemateFootprintFromViewer(remate.id) ?? remateStandaloneFootprint(remate);
  const boxFp =
    tryBoxFootprintFromViewer(box.id) ??
    boxWorkspaceFootprint(box as WorkspaceBox);
  const gap = measureGapBetween(remateFp, boxFp);
  return {
    ...gap,
    targetLabel: "módulo associado",
  };
}

export function measureRemateGapToRemate(
  remate: RematePiece,
  target: RematePiece
): RemateGapResult | null {
  if (remate.id === target.id) return null;
  const a = tryRemateFootprintFromViewer(remate.id) ?? remateStandaloneFootprint(remate);
  const b = tryRemateFootprintFromViewer(target.id) ?? remateStandaloneFootprint(target);
  const gap = measureGapBetween(a, b);
  return {
    ...gap,
    targetLabel: target.name,
  };
}

export function measureRemateGap(
  remate: RematePiece,
  options: {
    parentBox?: WorkspaceBox | BoxModule | null;
    targetRemate?: RematePiece | null;
  }
): RemateGapResult | null {
  if (options.targetRemate) {
    return measureRemateGapToRemate(remate, options.targetRemate);
  }
  if (options.parentBox) {
    return measureRemateGapToBox(remate, options.parentBox);
  }
  return null;
}
