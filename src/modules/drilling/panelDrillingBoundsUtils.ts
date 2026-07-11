import type { PanelDrillHole } from "../../core/types";

export const HOLE_PANEL_BOUNDS_TOL_MM = 0.2;

export const PANEL_DRILL_TRACE_SIGNATURE = { larguraMm: 722, alturaMm: 481 } as const;

type HoleLocalLike = {
  x: number;
  y: number;
  holeType?: string;
  diameter?: number;
  depth?: number;
  topDrillable?: boolean;
};

export function shouldTracePanelPiece(larguraMm: number, alturaMm: number): boolean {
  return (
    Math.abs(larguraMm - PANEL_DRILL_TRACE_SIGNATURE.larguraMm) < 0.5 &&
    Math.abs(alturaMm - PANEL_DRILL_TRACE_SIGNATURE.alturaMm) < 0.5
  );
}

export function clampPanelHoleLocalMm(
  x: number,
  y: number,
  larguraMm: number,
  alturaMm: number,
  tolMm = HOLE_PANEL_BOUNDS_TOL_MM
): { x: number; y: number; clamped: boolean } {
  const x0 = Number(x);
  const y0 = Number(y);
  if (!Number.isFinite(x0) || !Number.isFinite(y0)) {
    return { x: x0, y: y0, clamped: false };
  }
  const xClamped = Math.min(larguraMm + tolMm, Math.max(-tolMm, x0));
  const yClamped = Math.min(alturaMm + tolMm, Math.max(-tolMm, y0));
  return {
    x: xClamped,
    y: yClamped,
    clamped: xClamped !== x0 || yClamped !== y0,
  };
}

/** Garante 0 ≤ yLocal ≤ alturaMm + tol (idem para X). */
export function clampPanelDrillHolesToPieceBounds(
  holes: PanelDrillHole[] | undefined,
  larguraMm: number,
  alturaMm: number,
  context?: string
): PanelDrillHole[] {
  if (!holes?.length) return [];
  const trace = shouldTracePanelPiece(larguraMm, alturaMm);
  const clampedHoles: PanelDrillHole[] = [];
  const adjustments: Array<{ xIn: number; yIn: number; xOut: number; yOut: number; tipo?: string }> = [];

  for (const h of holes) {
    const { x, y, clamped } = clampPanelHoleLocalMm(h.x, h.y, larguraMm, alturaMm);
    if (clamped) {
      adjustments.push({
        xIn: h.x,
        yIn: h.y,
        xOut: x,
        yOut: y,
        tipo: h.holeType,
      });
    }
    clampedHoles.push({ ...h, x, y });
  }

  if (trace && adjustments.length > 0) {
    console.warn(
      "[PANEL-DRILL-TRACE]",
      JSON.stringify({
        stage: "clampPanelDrillHolesToPieceBounds",
        context,
        larguraMm,
        alturaMm,
        adjustments,
      })
    );
  }

  return clampedHoles;
}

/** Barreira antes de copyHolesLocalInvariant — clamp universal (não-portas). */
export function clampPanelHolesLocalBeforeInvariant<T extends HoleLocalLike>(
  holes: T[] | undefined,
  larguraMm: number,
  alturaMm: number,
  context: string,
  pieceId?: string
): T[] | undefined {
  if (!holes?.length) return holes;
  const trace = shouldTracePanelPiece(larguraMm, alturaMm);
  const out: T[] = [];
  const adjustments: Array<{ xIn: number; yIn: number; xOut: number; yOut: number; tipo?: string }> = [];

  for (const h of holes) {
    const { x, y, clamped } = clampPanelHoleLocalMm(h.x, h.y, larguraMm, alturaMm);
    if (clamped) {
      adjustments.push({
        xIn: h.x,
        yIn: h.y,
        xOut: x,
        yOut: y,
        tipo: h.holeType,
      });
    }
    out.push({ ...h, x, y });
  }

  if (trace && adjustments.length > 0) {
    console.warn(
      "[PANEL-DRILL-TRACE]",
      JSON.stringify({
        stage: "barrier_before_copyHolesLocalInvariant",
        context,
        pieceId,
        larguraMm,
        alturaMm,
        adjustments,
      })
    );
  }

  return out.length > 0 ? out : undefined;
}

export type PanelDrillPieceBounds = {
  larguraMm: number;
  alturaMm: number;
};
