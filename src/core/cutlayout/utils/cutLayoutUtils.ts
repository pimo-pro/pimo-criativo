import type { CutPiece, CutPlacement, SheetDefinition, SheetResult } from "../cutLayoutTypes";
import { isNestingRotationLocked } from "../../materials/nestingGrainLock";
import { canRotatePieceGeometry } from "./cutLayoutGeomRotation";

function resolvePieceRotationFlags(piece: CutPiece): {
  allowPieceRotation?: boolean;
  lockWoodGrain?: boolean;
} {
  const meta = piece.metadata;
  const allow =
    meta?.allowPieceRotation === true
      ? true
      : meta?.allowPieceRotation === false
        ? false
        : undefined;
  const lock =
    meta?.lockWoodGrain === true
      ? true
      : meta?.lockWoodGrain === false
        ? false
        : undefined;
  return { allowPieceRotation: allow, lockWoodGrain: lock };
}

const EPS = 0.001;

export function getPieceArea(piece: CutPiece): number {
  return Math.max(1, piece.largura_mm * piece.altura_mm);
}

export function getPieceAspectRatio(piece: CutPiece): number {
  const a = Math.max(piece.largura_mm, piece.altura_mm);
  const b = Math.max(1, Math.min(piece.largura_mm, piece.altura_mm));
  return a / b;
}

/**
 * Ordenação industrial partilhada: material → altura desc → largura desc → área desc.
 * Mantém a geometria original e só altera a prioridade de tentativa no nesting.
 */
export function comparePiecesForNesting(a: CutPiece, b: CutPiece): number {
  const matA = a.materialId ?? "";
  const matB = b.materialId ?? "";
  if (matA !== matB) return matA.localeCompare(matB);

  if (b.altura_mm !== a.altura_mm) return b.altura_mm - a.altura_mm;
  if (b.largura_mm !== a.largura_mm) return b.largura_mm - a.largura_mm;
  const areaDiff = getPieceArea(b) - getPieceArea(a);
  if (areaDiff !== 0) return areaDiff;
  return getPieceAspectRatio(b) - getPieceAspectRatio(a);
}

/** Limiar relativo para classificar peças "pequenas" no grupo de gap-fill. */
const SANDWICH_SMALL_AREA_RATIO = 0.12;

/**
 * Agrupa peças pequenas no fim da lista de produção para ficarem disponíveis ao
 * scan de gap-fill/rescue sem perturbar as chapas principais já compactas.
 */
export function applySandwichOrdering(sorted: CutPiece[]): CutPiece[] {
  if (sorted.length <= 4) return sorted;

  const maxArea = Math.max(...sorted.map(getPieceArea));
  const smallThreshold = maxArea * SANDWICH_SMALL_AREA_RATIO;

  const large: CutPiece[] = [];
  const small: CutPiece[] = [];
  for (const p of sorted) {
    if (getPieceArea(p) >= smallThreshold) large.push(p);
    else small.push(p);
  }

  if (small.length === 0 || large.length === 0) return sorted;

  return [...large, ...small];
}

/**
 * Determina se uma peça pode ser rodada 90° pelo motor de nesting.
 * Verifica grainDirection, dimensões quadradas e operações geométricas direcionais
 * (furos de face lateral com topDrillable=false não permitem rotação).
 */
export const isRotatablePiece = (piece: CutPiece): boolean => {
  if (piece.largura_mm === piece.altura_mm) return false;
  const flags = resolvePieceRotationFlags(piece);
  if (
    isNestingRotationLocked({
      materialId: piece.materialId,
      industrialGrainCode: piece.industrialGrainCode,
      pieceTipo: piece.pieceTipo,
      allowPieceRotation: flags.allowPieceRotation,
      lockWoodGrain: flags.lockWoodGrain,
    })
  ) {
    return false;
  }
  return canRotatePieceGeometry(piece);
};

export function reorderPieces(pieces: CutPiece[], mode: "production" | "gapFill" = "production"): CutPiece[] {
  const pieceSquareFriendly = (p: CutPiece): boolean => {
    const mx = Math.max(p.largura_mm, p.altura_mm);
    if (mx < EPS) return false;
    return Math.abs(p.largura_mm - p.altura_mm) / mx < 0.05;
  };
  const pieceLongStrip = (p: CutPiece): boolean => getPieceAspectRatio(p) >= 3;

  if (mode === "production") {
    const sorted = [...pieces].sort(comparePiecesForNesting);
    return applySandwichOrdering(sorted);
  }

  return [...pieces].sort((a, b) => {
    const longA = pieceLongStrip(a) ? 1 : 0;
    const longB = pieceLongStrip(b) ? 1 : 0;
    if (longA !== longB) return longA - longB;
    const sqA = pieceSquareFriendly(a) ? 0 : 1;
    const sqB = pieceSquareFriendly(b) ? 0 : 1;
    if (sqA !== sqB) return sqA - sqB;
    const areaDiff = getPieceArea(a) - getPieceArea(b);
    if (areaDiff !== 0) return areaDiff;
    return getPieceAspectRatio(a) - getPieceAspectRatio(b);
  });
}

export function isInsideSheet(x: number, y: number, w: number, h: number, sheet: SheetDefinition): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return false;
  if (w <= 0 || h <= 0) return false;
  if (x < -EPS || y < -EPS) return false;
  if (x + w > sheet.largura_mm + EPS) return false;
  if (y + h > sheet.altura_mm + EPS) return false;
  return true;
}

export function createUsableSheetArea(sheet: SheetDefinition, marginMm: number): SheetDefinition {
  return {
    ...sheet,
    largura_mm: Math.max(1, sheet.largura_mm - marginMm * 2),
    altura_mm: Math.max(1, sheet.altura_mm - marginMm * 2),
  };
}

export function applyFixedMarginOffset(
  sheets: SheetResult[],
  physicalSheet: SheetDefinition,
  marginMm: number
): SheetResult[] {
  return sheets.map((s, idx) => ({
    sheet: { ...physicalSheet },
    placements: s.placements.map((p) => ({
      ...p,
      x_mm: p.x_mm + marginMm,
      y_mm: p.y_mm + marginMm,
      sheetIndex: idx,
    })),
  }));
}

export function overlaps(x: number, y: number, w: number, h: number, placed: Array<{ x: number; y: number; w: number; h: number }>, kerf: number): boolean {
  const margin = kerf / 2;
  for (const r of placed) {
    if (x + w + margin > r.x - margin && r.x + r.w + margin > x - margin && y + h + margin > r.y - margin && r.y + r.h + margin > y - margin) return true;
  }
  return false;
}

export function expandPieces(pieces: CutPiece[]): CutPiece[] {
  const out: CutPiece[] = [];
  for (const p of pieces) {
    for (let i = 0; i < (p.quantidade ?? 1); i++) out.push({ ...p, quantidade: 1 });
  }
  return out;
}

export function groupByMaterialAndThickness(pieces: CutPiece[]): Map<string, CutPiece[]> {
  const map = new Map<string, CutPiece[]>();
  for (const p of pieces) {
    const key = `${p.materialId ?? "material"}|${p.espessura_mm}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return map;
}

export function groupByThicknessOnly(pieces: CutPiece[]): Map<string, CutPiece[]> {
  const map = new Map<string, CutPiece[]>();
  for (const p of pieces) {
    const key = String(p.espessura_mm);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return map;
}

export function estimateUsefulLeftover(sheet: SheetDefinition, placed: Array<{ x: number; y: number; w: number; h: number }>): number {
  if (placed.length === 0) return sheet.largura_mm * sheet.altura_mm;
  const maxX = Math.max(...placed.map((r) => r.x + r.w));
  const maxY = Math.max(...placed.map((r) => r.y + r.h));
  const rightStrip = Math.max(0, sheet.largura_mm - maxX) * sheet.altura_mm;
  const topStrip = Math.max(0, sheet.altura_mm - maxY) * sheet.largura_mm;
  return Math.max(rightStrip, topStrip);
}

export function cloneSheets(sheets: SheetResult[]): SheetResult[] {
  return sheets.map((s) => ({ sheet: { ...s.sheet }, placements: s.placements.map((p) => ({ ...p })) }));
}

export function flattenPlacements(sheets: SheetResult[]): CutPlacement[] {
  return sheets.flatMap((s, sheetIndex) => s.placements.map((p) => ({ ...p, sheetIndex })));
}

export function partitionPlacementsIntoSheets(placements: CutPlacement[], sheet: SheetDefinition): SheetResult[] {
  const groups = new Map<number, CutPlacement[]>();
  for (const p of placements) {
    if (!groups.has(p.sheetIndex)) groups.set(p.sheetIndex, []);
    groups.get(p.sheetIndex)!.push(p);
  }
  const sorted = Array.from(groups.keys()).sort((a, b) => a - b);
  return sorted.map((idx, normalizedIndex) => ({
    sheet: { ...sheet },
    placements: (groups.get(idx) ?? []).map((p) => ({ ...p, sheetIndex: normalizedIndex })),
  }));
}

export function layoutFromPlacements(
  placements: CutPlacement[],
  sheet: SheetDefinition
): { sheets: SheetResult[]; rejectedByLimit: Array<{ partName: string; boxId: string; largura_mm: number; altura_mm: number; reason: string }> } {
  const rejectedByLimit: Array<{ partName: string; boxId: string; largura_mm: number; altura_mm: number; reason: string }> = [];
  const grouped = partitionPlacementsIntoSheets(placements, sheet);
  const validSheets: SheetResult[] = [];
  for (const s of grouped) {
    const valid: CutPlacement[] = [];
    const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
    for (const p of s.placements) {
      const inside = isInsideSheet(p.x_mm, p.y_mm, p.largura_mm, p.altura_mm, sheet);
      const collides = overlaps(p.x_mm, p.y_mm, p.largura_mm, p.altura_mm, rects, 0);
      if (!inside || collides) {
        rejectedByLimit.push({
          partName: p.partName,
          boxId: p.boxId,
          largura_mm: p.largura_mm,
          altura_mm: p.altura_mm,
          reason: !inside ? "meta-outside-sheet" : "meta-overlap",
        });
        continue;
      }
      valid.push(p);
      rects.push({ x: p.x_mm, y: p.y_mm, w: p.largura_mm, h: p.altura_mm });
    }
    if (valid.length > 0) {
      validSheets.push({ sheet: { ...sheet }, placements: valid.map((p) => ({ ...p, sheetIndex: validSheets.length })) });
    }
  }
  return { sheets: validSheets, rejectedByLimit };
}
