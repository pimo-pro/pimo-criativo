/**
 * Invariante geométrica dos furos no pipeline industrial.
 *
 * SSOT: furos em coordenadas locais da peça [0..designW] × [0..designH].
 * Em qualquer etapa: offsetPlacement = R(rot) * holeLocal; absoluto = T(sheet) + offsetPlacement.
 * Proibido: recalcular furos, trocar eixos, rotação diferente da peça, normalizar com dims novas.
 */

import { holeLocalToSheetOffsetMm } from "../layoutCoordinateSystem";

export type HoleLike = {
  x: number;
  y: number;
  diameter?: number;
  depth?: number;
  holeType?: string;
  topDrillable?: boolean;
};

/** Furo validado com diâmetro e profundidade obrigatórios (pipeline industrial). */
export type DrillHoleInvariant = {
  x: number;
  y: number;
  diameter: number;
  depth: number;
  holeType?: string;
  topDrillable?: boolean;
};

export type HoleTraceStage =
  | "A_cutlist"
  | "B_cutlistToPieces"
  | "C_convertProjectToV3"
  | "D_nestingPlacement"
  | "E_export";

export type HoleTraceEntry = {
  stage: HoleTraceStage;
  pieceId: string;
  width: number;
  height: number;
  rotation?: number;
  sheetX?: number;
  sheetY?: number;
  holes: Array<{
    xLocal: number;
    yLocal: number;
    xSheet?: number;
    ySheet?: number;
    face?: string;
    tipo?: string;
  }>;
  flags?: {
    dimensionsSwapped?: boolean;
    implicitRotation?: boolean;
    holesTransformed?: boolean;
  };
};

const traceLog: HoleTraceEntry[] = [];
const EPS = 0.001;

export function isHolePipelineTraceEnabled(): boolean {
  if (typeof globalThis !== "undefined" && (globalThis as { __PIMO_HOLE_TRACE__?: boolean }).__PIMO_HOLE_TRACE__) {
    return true;
  }
  if (typeof process !== "undefined" && process.env?.PIMO_HOLE_TRACE === "1") return true;
  return false;
}

export function clearHolePipelineTraceLog(): void {
  traceLog.length = 0;
}

export function getHolePipelineTraceLog(): HoleTraceEntry[] {
  return [...traceLog];
}

export function traceHolePipeline(entry: HoleTraceEntry): void {
  if (!isHolePipelineTraceEnabled()) return;
  traceLog.push(entry);
  console.log(`[HOLE-TRACE:${entry.stage}]`, JSON.stringify(entry, null, 2));
}

export function normalizeHoleRotationDeg(rotacao: number): 0 | 90 | 180 | 270 {
  const r = ((Math.round(rotacao) % 360) + 360) % 360;
  if (r === 90) return 90;
  if (r === 180) return 180;
  if (r === 270) return 270;
  return 0;
}

/** Dimensões de desenho (pré-rotação nesting) a partir do placement ou metadata. */
export function resolvePieceDesignDims(input: {
  largura_mm: number;
  altura_mm: number;
  rotacao?: number;
  metadata?: Record<string, unknown>;
}): { designW: number; designH: number; placementSwapped: boolean } {
  const metaW = Number(input.metadata?.holeDesignLarguraMm);
  const metaH = Number(input.metadata?.holeDesignAlturaMm);
  if (Number.isFinite(metaW) && metaW > 0 && Number.isFinite(metaH) && metaH > 0) {
    const rot = normalizeHoleRotationDeg(input.rotacao ?? 0);
    const swapped = rot === 90 || rot === 270;
    return { designW: metaW, designH: metaH, placementSwapped: swapped };
  }
  const rot = normalizeHoleRotationDeg(input.rotacao ?? 0);
  const swapped = rot === 90 || rot === 270;
  return {
    designW: swapped ? input.altura_mm : input.largura_mm,
    designH: swapped ? input.largura_mm : input.altura_mm,
    placementSwapped: swapped,
  };
}

/**
 * R(rot) sobre coordenadas locais de desenho → offset no retângulo de colocação.
 * Convenção 90° CCW: (hx, hy) → (hy, designW − hx).
 */
export function transformHoleLocalToPlacementOffset(
  hx: number,
  hy: number,
  rotacaoDeg: number,
  designW: number,
  designH: number
): { px: number; py: number } {
  const r = normalizeHoleRotationDeg(rotacaoDeg);
  if (r === 90) return { px: hy, py: designW - hx };
  if (r === 180) return { px: designW - hx, py: designH - hy };
  if (r === 270) return { px: designH - hy, py: hx };
  return { px: hx, py: hy };
}

/** R + T: coordenadas absolutas na chapa (origem BL). */
export function transformHoleLocalToSheetAbsolute(
  hx: number,
  hy: number,
  rotacaoDeg: number,
  designW: number,
  designH: number,
  sheetX: number,
  sheetY: number
): { xSheet: number; ySheet: number } {
  const off = transformHoleLocalToPlacementOffset(hx, hy, rotacaoDeg, designW, designH);
  return { xSheet: sheetX + off.px, ySheet: sheetY + off.py };
}

export function assertHolesWithinLocalPieceBounds(
  holes: Array<{ x: number; y: number; diameter?: number }>,
  larguraMm: number,
  alturaMm: number,
  context = "peça"
): void {
  for (const h of holes) {
    const r = Number.isFinite(h.diameter) && (h.diameter ?? 0) > 0 ? (h.diameter ?? 0) / 2 : 0;
    if (h.x < r - EPS || h.y < r - EPS) {
      throw new Error(`[holeInvariant] Furo fora de ${context} (x=${h.x}, y=${h.y}, largura=${larguraMm})`);
    }
    if (h.x > larguraMm - r + EPS || h.y > alturaMm - r + EPS) {
      throw new Error(`[holeInvariant] Furo fora de ${context} (x=${h.x}, y=${h.y}, altura=${alturaMm})`);
    }
  }
}

export function holeRelativePositions(
  holes: Array<{ x: number; y: number }>,
  larguraMm: number,
  alturaMm: number
): Array<{ rx: number; ry: number }> {
  const w = Math.max(1, larguraMm);
  const h = Math.max(1, alturaMm);
  return holes.map((hole) => ({ rx: hole.x / w, ry: hole.y / h }));
}

/** Copia furos sem transformação; valida bounds no referencial de desenho. */
export function copyHolesLocalInvariant(
  holes: HoleLike[] | undefined,
  designW: number,
  designH: number
): DrillHoleInvariant[] | undefined {
  if (!holes?.length) return undefined;
  const out: DrillHoleInvariant[] = [];
  for (const h of holes) {
    if (h.holeType === "cavilha" && h.topDrillable === false) continue;
    const x = Number(h.x);
    const y = Number(h.y);
    const diameter = Number(h.diameter);
    const depth = Number(h.depth);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !(diameter > 0) || !(depth > 0)) continue;
    out.push({
      x,
      y,
      diameter,
      depth,
      holeType: h.holeType,
      topDrillable: h.topDrillable,
    });
  }
  if (out.length === 0) return undefined;
  assertHolesWithinLocalPieceBounds(out, designW, designH, "copyHolesLocalInvariant");
  return out;
}

export function assertHolesPlacementWithinPiece(
  holes: HoleLike[],
  rotacaoDeg: number,
  designW: number,
  designH: number,
  placementW: number,
  placementH: number
): void {
  for (const h of holes) {
    const r = Number.isFinite(h.diameter) && (h.diameter ?? 0) > 0 ? (h.diameter ?? 0) / 2 : 0;
    const off = transformHoleLocalToPlacementOffset(h.x, h.y, rotacaoDeg, designW, designH);
    if (off.px < r - EPS || off.py < r - EPS) {
      throw new Error(`[holeInvariant] Furo fora do placement após R (px=${off.px}, py=${off.py})`);
    }
    if (off.px > placementW - r + EPS || off.py > placementH - r + EPS) {
      throw new Error(`[holeInvariant] Furo fora do placement após R (px=${off.px}, py=${off.py}, pl=${placementW}×${placementH})`);
    }
  }
}

/** Simula coordenadas finais de export (sem invocar geradores TCN). */
export function computeExportHoleSheetCoords(placement: {
  x_mm: number;
  y_mm: number;
  largura_mm: number;
  altura_mm: number;
  rotacao?: number;
  metadata?: Record<string, unknown>;
  drillHoles?: HoleLike[];
  holes?: HoleLike[];
  originalDrillHoles?: HoleLike[];
}): Array<{ xLocal: number; yLocal: number; xSheet: number; ySheet: number }> {
  const { designW, designH } = resolvePieceDesignDims(placement);
  const source = placement.originalDrillHoles ?? placement.drillHoles ?? placement.holes ?? [];
  const rot = placement.rotacao ?? 0;
  return source.map((h) => {
    const off = holeLocalToSheetOffsetMm(h.x, h.y, rot, placement.largura_mm, placement.altura_mm, designW, designH);
    return {
      xLocal: h.x,
      yLocal: h.y,
      xSheet: placement.x_mm + off.sx,
      ySheet: placement.y_mm + off.sy,
    };
  });
}

export function tracePlacementHoles(
  stage: HoleTraceStage,
  pieceId: string,
  placement: {
    x_mm: number;
    y_mm: number;
    largura_mm: number;
    altura_mm: number;
    rotacao?: number;
    metadata?: Record<string, unknown>;
    drillHoles?: HoleLike[];
    originalDrillHoles?: HoleLike[];
  }
): void {
  const { designW, designH, placementSwapped } = resolvePieceDesignDims(placement);
  const holes = placement.originalDrillHoles ?? placement.drillHoles ?? [];
  const sheetCoords = computeExportHoleSheetCoords(placement);
  traceHolePipeline({
    stage,
    pieceId,
    width: designW,
    height: designH,
    rotation: placement.rotacao ?? 0,
    sheetX: placement.x_mm,
    sheetY: placement.y_mm,
    holes: holes.map((h, i) => ({
      xLocal: h.x,
      yLocal: h.y,
      xSheet: sheetCoords[i]?.xSheet,
      ySheet: sheetCoords[i]?.ySheet,
      tipo: h.holeType,
    })),
    flags: {
      dimensionsSwapped: placementSwapped,
      implicitRotation: false,
      holesTransformed: false,
    },
  });
}
