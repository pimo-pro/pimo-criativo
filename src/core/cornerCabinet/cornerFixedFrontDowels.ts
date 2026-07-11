import type { PanelDrillHole } from "../types";
import { dedupePanelDrillHoles } from "../../modules/drilling/drillHoleDedup";
import {
  DRILL_DOWEL_DIAMETER_MM,
  getDrillFrontDistance,
} from "../drill/drillConfig";

/** Profundidade dos furos de cavilha na espessura (lado da peça). */
export const CORNER_FF_EDGE_DOWEL_DEPTH_MM = 30;
/** Profundidade dos furos de cavilha na face da frente fixa. */
export const CORNER_FF_FACE_DOWEL_DEPTH_MM = 13;

export type CornerFixedFrontDowelLayout = {
  fixedFrontWidthMm: number;
  fixedFrontHeightMm: number;
  /** Largura da peça cima/fundo (mm) — para posicionar furos quando a frente fixa está à direita. */
  panelWidthMm: number;
  /** Lado da caixa onde a frente fixa está montada. */
  fixedFrontSide: "left" | "right";
  /** Espessura do material (mm) — distância à borda = espessura/2. */
  thicknessMm?: number;
};

export type CornerFixedFrontDowelHolesByPanel = {
  cima: PanelDrillHole[];
  fundo: PanelDrillHole[];
  lateral_esquerda?: PanelDrillHole[];
  lateral_direita?: PanelDrillHole[];
  frente_fixa: PanelDrillHole[];
};

export type CornerDowelOffsets = {
  /** Centro do furo a espessura/2 da borda perpendicular (mm). */
  edgeOffset: number;
  /** 60 mm para dentro a partir da face frontal (mm). */
  depthOffset: number;
};

export function resolveCornerDowelOffsets(thicknessMm: number): CornerDowelOffsets {
  const thickness = Math.max(1, thicknessMm);
  return {
    edgeOffset: thickness / 2,
    depthOffset: getDrillFrontDistance(),
  };
}

function edgeDowelHole(x: number, y: number): PanelDrillHole {
  return {
    x,
    y,
    diameter: DRILL_DOWEL_DIAMETER_MM,
    depth: CORNER_FF_EDGE_DOWEL_DEPTH_MM,
    holeType: "cavilha",
    topDrillable: false,
    face: "B",
  };
}

function faceDowelHole(x: number, y: number): PanelDrillHole {
  return {
    x,
    y,
    diameter: DRILL_DOWEL_DIAMETER_MM,
    depth: CORNER_FF_FACE_DOWEL_DEPTH_MM,
    holeType: "cavilha",
    topDrillable: true,
    face: "B",
  };
}

function resolveFixedFrontHoleSpanX(
  layout: CornerFixedFrontDowelLayout,
  depthOffset: number,
  edgeOffset: number
): { xStart: number; xEnd: number; xLateralEdge: number } {
  const ffW = Math.max(depthOffset * 2 + 1, layout.fixedFrontWidthMm);
  if (layout.fixedFrontSide === "left") {
    return {
      xStart: depthOffset,
      xEnd: ffW - depthOffset,
      xLateralEdge: edgeOffset,
    };
  }
  const panelW = Math.max(ffW, layout.panelWidthMm);
  return {
    xStart: panelW - ffW + depthOffset,
    xEnd: panelW - depthOffset,
    xLateralEdge: panelW - ffW + edgeOffset,
  };
}

/**
 * Coordenadas Y da frente fixa alinhadas à lateral (origem Y=0 na base — Layout PRO / cutlist).
 * edgeOffset = espessura/2 da borda superior/inferior da lateral.
 */
export function resolveFrenteFixaLateralHoleYFromTop(
  frenteHeightMm: number,
  lateralHeightMm: number,
  edgeOffset: number
): { topY: number; bottomY: number } {
  const inset = Math.max(0, (frenteHeightMm - lateralHeightMm) / 2);
  return {
    topY: inset + Math.max(edgeOffset, lateralHeightMm - edgeOffset),
    bottomY: inset + edgeOffset,
  };
}

/**
 * Furos de cavilha entre CIMA/FUNDO/lateral e frente fixa (módulo Canto — Direita Inferior).
 * Convenção industrial (Layout PRO): origem canto inferior-esquerdo, Y↑.
 * - Borda perpendicular: centro a espessura/2
 * - Face frontal: 60 mm para dentro (depthOffset)
 */
export function buildCornerFixedFrontDowelHoles(
  layout: CornerFixedFrontDowelLayout,
  lateralHeightMm: number
): CornerFixedFrontDowelHolesByPanel {
  const { edgeOffset, depthOffset } = resolveCornerDowelOffsets(layout.thicknessMm ?? 19);
  const ffH = Math.max(edgeOffset * 2 + 1, layout.fixedFrontHeightMm);
  const { xStart, xEnd, xLateralEdge } = resolveFixedFrontHoleSpanX(layout, depthOffset, edgeOffset);

  const yTop = ffH - edgeOffset;
  const yBottom = edgeOffset;
  const lateralY = resolveFrenteFixaLateralHoleYFromTop(ffH, lateralHeightMm, edgeOffset);

  const latTopY = Math.max(edgeOffset, lateralHeightMm - edgeOffset);
  const latBottomY = edgeOffset;
  const lateralHoles = [
    edgeDowelHole(depthOffset, latTopY),
    edgeDowelHole(depthOffset, latBottomY),
  ];

  const frenteFaceHoles: PanelDrillHole[] = [
    faceDowelHole(xStart, yTop),
    faceDowelHole(xEnd, yTop),
    faceDowelHole(xStart, yBottom),
    faceDowelHole(xEnd, yBottom),
    faceDowelHole(xLateralEdge, lateralY.topY),
    faceDowelHole(xLateralEdge, lateralY.bottomY),
  ];

  const result: CornerFixedFrontDowelHolesByPanel = {
    cima: [edgeDowelHole(xStart, depthOffset), edgeDowelHole(xEnd, depthOffset)],
    fundo: [edgeDowelHole(xStart, depthOffset), edgeDowelHole(xEnd, depthOffset)],
    frente_fixa: dedupePanelDrillHoles(frenteFaceHoles),
  };

  if (layout.fixedFrontSide === "left") {
    result.lateral_esquerda = lateralHoles;
  } else {
    result.lateral_direita = lateralHoles;
  }

  return result;
}

const HINGE_HOLE_TYPES = new Set([
  "dobradica",
  "dobradica_fixacao",
  "dobradica_parafuso_uniao",
]);

export function stripCornerFixedFrontHingeHoles(holes: PanelDrillHole[]): PanelDrillHole[] {
  return holes.filter((h) => !HINGE_HOLE_TYPES.has(h.holeType ?? ""));
}

export { dedupePanelDrillHoles } from "../../modules/drilling/drillHoleDedup";

/** Conta ligações lógicas (2 cima + 2 fundo + 2 lateral) antes de deduplicar. */
export function countCornerFixedFrontFaceDowelConnections(): number {
  return 6;
}
