/**
 * Invariantes visuais do highlight/outline do viewer — camada de proteção (Fase 4).
 */

import type { TechnicalDrillHole } from "../../../core/types";
import type { PanelOutlineDims, PanelOutlineKind } from "./viewerHighlightGeometry";
import { holeMmToLocalMeters, resolveHoleDrillEntryFrame } from "./viewerHighlightGeometry";

export type ViewerHighlightInvariantCode =
  | "HIGHLIGHT_WITHOUT_HOLES"
  | "HIGHLIGHT_WITHOUT_PIECE_MESH"
  | "HIGHLIGHT_FACE_MISMATCH"
  | "HIGHLIGHT_SPURIOUS_SEGMENT"
  | "HIGHLIGHT_ORPHAN_OVERLAY";

export type ViewerHighlightInvariantViolation = {
  code: ViewerHighlightInvariantCode;
  meshId: string;
  holeIndex?: number;
  detail: string;
};

export type ViewerHighlightOverlaySnapshot = {
  isPanelEdgeOverlay?: boolean;
  isIndustrialDesignHoleOverlay?: boolean;
  parentPieceUuid?: string;
};

export type AssertViewerHighlightOptions = {
  /** Se true, exige zero overlays de furo quando holes está vazio. */
  holesOnlyMode?: boolean;
  maxSpuriousSegmentLengthM?: number;
};

const DEFAULT_MAX_SPURIOUS_M = 0.05;

function segmentLength(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Verifica que uma geometria de furo não contém segmentos longos espúrios. */
export function findSpuriousSegmentsInGeometry(
  positions: Float32Array | number[],
  maxLengthM: number
): number[] {
  const arr = positions instanceof Float32Array ? positions : new Float32Array(positions);
  const bad: number[] = [];
  for (let i = 0; i + 5 < arr.length; i += 6) {
    const len = segmentLength(arr[i], arr[i + 1], arr[i + 2], arr[i + 3], arr[i + 4], arr[i + 5]);
    if (len > maxLengthM) bad.push(i / 6);
  }
  return bad;
}

/** Bloqueia highlight em meshes não reconhecidas (proxies, layout bounds). */
export function assertKnownPieceMesh(
  meshId: string,
  isKnown: boolean
): ViewerHighlightInvariantViolation[] {
  if (isKnown) return [];
  return [
    {
      code: "HIGHLIGHT_WITHOUT_PIECE_MESH",
      meshId,
      detail: "tentativa de highlight em mesh não reconhecida pelo viewer",
    },
  ];
}

/** Valida overlays de furo relativamente aos dados SSOT. */
export function assertViewerHighlightInvariants(
  meshId: string,
  meshUuid: string,
  panelType: PanelOutlineKind,
  dims: PanelOutlineDims,
  holes: TechnicalDrillHole[],
  holeOverlays: ViewerHighlightOverlaySnapshot[],
  holeGeometries: Array<{ positions: Float32Array } | null>,
  options: AssertViewerHighlightOptions = {}
): ViewerHighlightInvariantViolation[] {
  const violations: ViewerHighlightInvariantViolation[] = [];
  const maxSpurious = options.maxSpuriousSegmentLengthM ?? DEFAULT_MAX_SPURIOUS_M;

  if (options.holesOnlyMode && holes.length === 0 && holeOverlays.length > 0) {
    violations.push({
      code: "HIGHLIGHT_WITHOUT_HOLES",
      meshId,
      detail: `${holeOverlays.length} overlay(s) de furo sem furos SSOT`,
    });
  }

  for (const overlay of holeOverlays) {
    if (overlay.isIndustrialDesignHoleOverlay && overlay.parentPieceUuid !== meshUuid) {
      violations.push({
        code: "HIGHLIGHT_ORPHAN_OVERLAY",
        meshId,
        detail: `overlay de furo sem parentPieceUuid=${meshUuid}`,
      });
    }
  }

  holeGeometries.forEach((geo, holeIndex) => {
    if (!geo) return;
    const badSegs = findSpuriousSegmentsInGeometry(geo.positions, maxSpurious);
    if (badSegs.length > 0) {
      violations.push({
        code: "HIGHLIGHT_SPURIOUS_SEGMENT",
        meshId,
        holeIndex,
        detail: `segmento(s) longo(s) no overlay do furo: índices ${badSegs.join(",")}`,
      });
    }
  });

  holes.forEach((hole, holeIndex) => {
    const local = holeMmToLocalMeters(panelType, dims, hole);
    const frame = resolveHoleDrillEntryFrame(panelType, dims, hole);
    if (!local || !frame) return;

    if (hole.face === "esquerda" || hole.face === "direita") {
      if (panelType === "top" || panelType === "bottom") {
        const onEdge = Math.abs(Math.abs(local.x) - dims.width / 2) < 0.002;
        if (!onEdge) {
          violations.push({
            code: "HIGHLIGHT_FACE_MISMATCH",
            meshId,
            holeIndex,
            detail: `furo face=${hole.face} não está na espessura lateral (x=${local.x.toFixed(4)})`,
          });
        }
      } else if (panelType === "left" || panelType === "right") {
        const onThicknessEdge = Math.abs(Math.abs(local.x) - dims.thickness / 2) < 0.002;
        if (!onThicknessEdge) {
          violations.push({
            code: "HIGHLIGHT_FACE_MISMATCH",
            meshId,
            holeIndex,
            detail: `furo lateral face=${hole.face} não está na espessura (x=${local.x.toFixed(4)})`,
          });
        }
      }
    }
  });

  return violations;
}

export function isViewerHighlightInvariantEnabled(): boolean {
  if (typeof globalThis !== "undefined" && (globalThis as { __PIMO_VIEWER_HIGHLIGHT_INVARIANT__?: boolean }).__PIMO_VIEWER_HIGHLIGHT_INVARIANT__) {
    return true;
  }
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) return true;
  return false;
}

export function logViewerHighlightViolations(violations: ViewerHighlightInvariantViolation[]): void {
  if (!violations.length) return;
  console.warn("[ViewerHighlightInvariant]", violations);
}
