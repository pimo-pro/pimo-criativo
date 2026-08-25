/**
 * Regra industrial global — Cavilha 10–40 (par 10–30 espessura ? 10–13 face).
 *
 * Sempre que existir um furo —10–30 na espessura de uma peça A, deve existir
 * o furo —10–13 na face da peça B de encaixe, e uma ferragem CAVILHA_10x40
 * associada ao par.
 */

export const CAVILHA_10x40_FERRAGEM_ID = "cavilha_10x40";
/** Nome comercial em documentos (PDF/XLSX). ID técnico permanece `cavilha_10x40`. */
export const CAVILHA_10x40_FERRAGEM_NOME = "Cavilha 10mm";
export const CAVILHA_10x40_COR = "bege";
export const CAVILHA_10x40_DIAMETER_MM = 10;
export const CAVILHA_10x40_LENGTH_MM = 40;

/** Furo na espessura (peça A). */
export const CAVILHA_EDGE_DEPTH_MM = 30;
/** Furo na face (peça B). */
export const CAVILHA_FACE_DEPTH_MM = 13;

export const CAVILHA_EDGE_HOLE_TYPE_ID = "cavilha_10x30" as const;
export const CAVILHA_FACE_HOLE_TYPE_ID = "cavilha_10x13" as const;

/** True se o furo — cavilha de espessura industrial (10–30). */
export function isIndustrialEdgeCavilhaHole(h: {
  diameter?: number;
  depth?: number;
  holeType?: string;
  topDrillable?: boolean;
  holeCatalogId?: string;
}): boolean {
  if (h.holeCatalogId === CAVILHA_EDGE_HOLE_TYPE_ID) return true;
  if (h.holeType != null && h.holeType !== "cavilha") return false;
  if (h.topDrillable === true) return false;
  return (
    Math.abs((h.diameter ?? 0) - CAVILHA_10x40_DIAMETER_MM) < 0.05 &&
    Math.abs((h.depth ?? 0) - CAVILHA_EDGE_DEPTH_MM) < 0.05
  );
}

/** True se o furo — cavilha de face industrial (10–13). */
export function isIndustrialFaceCavilhaHole(h: {
  diameter?: number;
  depth?: number;
  holeType?: string;
  topDrillable?: boolean;
  holeCatalogId?: string;
}): boolean {
  if (h.holeCatalogId === CAVILHA_FACE_HOLE_TYPE_ID) return true;
  if (h.holeType != null && h.holeType !== "cavilha") return false;
  if (h.topDrillable === false) return false;
  return (
    Math.abs((h.diameter ?? 0) - CAVILHA_10x40_DIAMETER_MM) < 0.05 &&
    Math.abs((h.depth ?? 0) - CAVILHA_FACE_DEPTH_MM) < 0.05
  );
}

/**
 * Conta ferragens CAVILHA_10x40 a partir de furos de espessura 10–30
 * (1 ferragem física por par A?B — nunca contar o furo de face).
 */
export function countCavilha10x40FromEdgeHoles(
  holes: Array<{
    diameter?: number;
    depth?: number;
    holeType?: string;
    topDrillable?: boolean;
    holeCatalogId?: string;
  }>
): number {
  let n = 0;
  for (const h of holes) {
    if (isIndustrialEdgeCavilhaHole(h)) n += 1;
  }
  return n;
}
