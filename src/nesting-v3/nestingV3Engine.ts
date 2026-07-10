/**
 * Nesting V3 — Motor de auto-distribuição.
 *
 * Etapa 2: runCutLayout + finalizeIndustrialLayout (via layoutPipeline) quando
 * enableV3IndustrialAutoLayout=true; fallback nesting3 legacy caso contrário.
 */

import type { V3Piece, V3Sheet, V3Placement, V3AutoLayoutResult, NestingV3State } from "./nestingV3Types";
import type { NestingV3Settings } from "./nestingV3Settings";
import { allowRotationForPiece } from "./nestingV3Settings";
import { resolveNestingLayoutGrainDirection } from "../core/materials/nestingGrainLock";
import { runCutLayout } from "../core/cutlayout/cutLayoutEngine";
import type { CutLayoutEngineOptions, SheetDefinition } from "../core/cutlayout/cutLayoutTypes";
import { getDefaultCncLayoutOptions } from "../core/cnc/cncPipeline";
import { v3PiecesToCutPieces } from "../core/cutlayout/integration/v3ToCutPieces";
import { cutLayoutResultToV3State } from "../core/cutlayout/integration/cutLayoutResultToV3State";
import { tracePlacementHoles, transformHoleLocalToPlacementOffset } from "../core/cutlayout/utils/holeGeomInvariant";
import { defaultSheetFromSettings } from "./nestingSheetsFactory";
import { runHybridNesting } from "../core/nesting3/hybridNesting";
import type { Nesting3Piece, Nesting3Sheet } from "../core/nesting3/nesting3Types";

function effectiveDims(piece: V3Piece): { w: number; h: number } {
  const rotated = piece.rotation === 90 || piece.rotation === 270;
  return rotated
    ? { w: piece.heightMm, h: piece.widthMm }
    : { w: piece.widthMm, h: piece.heightMm };
}

function sheetDefinitionFromV3Sheet(sheet: V3Sheet): SheetDefinition {
  return {
    largura_mm: sheet.widthMm,
    altura_mm: sheet.heightMm,
    espessura_mm: sheet.thicknessMm,
    materialId: sheet.materialId,
    materialName: sheet.materialName,
  };
}

function buildIndustrialLayoutOptions(sheetDef: SheetDefinition, settings: NestingV3Settings): CutLayoutEngineOptions {
  return {
    ...getDefaultCncLayoutOptions(sheetDef),
    kerf_mm: settings.kerfMm,
    sheetLargura_mm: sheetDef.largura_mm,
    sheetAltura_mm: sheetDef.altura_mm,
    originTopRight: false,
    collectDiagnostics: true,
  };
}

/**
 * Pipeline Etapa 2:
 * v3ToCutPieces → runCutLayout (+ finalizeIndustrialLayout interno) → cutLayoutResultToV3State
 */
export function runV3IndustrialAutoLayoutPipeline(baseState: NestingV3State): V3AutoLayoutResult {
  const { pieces, sheets, settings } = baseState;
  const activeSheets = sheets.length > 0 ? sheets : [defaultSheetFromSettings(settings)];
  const cutPieces = v3PiecesToCutPieces(pieces, settings);
  const primarySheet = activeSheets[0]!;
  const sheetDef = sheetDefinitionFromV3Sheet(primarySheet);
  const layoutOptions = buildIndustrialLayoutOptions(sheetDef, settings);

  const layoutResult = runCutLayout(cutPieces, sheetDef, layoutOptions);
  for (const sheet of layoutResult.sheets) {
    for (const pl of sheet.placements) {
      if ((pl.drillHoles?.length ?? 0) > 0 || (pl.originalDrillHoles?.length ?? 0) > 0) {
        tracePlacementHoles(
          "D_nestingPlacement",
          String(pl.metadata?.v3PieceId ?? pl.partName ?? "piece"),
          pl
        );
      }
    }
  }
  const newState = cutLayoutResultToV3State(layoutResult, {
    ...baseState,
    sheets: activeSheets,
  });

  return {
    placements: newState.placements,
    unplacedPieceIds: newState.unplacedPieceIds,
    sheetsUsed: newState.sheets.length,
    sheets: newState.sheets,
    pieces: newState.pieces,
    selectedStrategy: layoutResult.diagnostics?.flow.selectedStrategy,
    selectedBinHeuristic: layoutResult.diagnostics?.flow.selectedBinHeuristic,
  };
}

/** Motor legacy nesting3 (pré-Etapa 2). */
export function runNestingV3AutoLayoutLegacy(
  pieces: V3Piece[],
  sheets: V3Sheet[],
  settings: NestingV3Settings
): V3AutoLayoutResult {
  if (pieces.length === 0) return { placements: [], unplacedPieceIds: [], sheetsUsed: 0 };

  const margin = settings.marginMm;
  const kerfMm = settings.kerfMm;
  const nestingPieces: Nesting3Piece[] = pieces.map((piece, index) => {
    const layoutGrain = resolveNestingLayoutGrainDirection({
      materialId: piece.materialId,
      industrialGrainCode: piece.industrialGrainCode,
      pieceTipo: piece.pieceTipo,
      allowPieceRotation: piece.allowPieceRotation,
      lockWoodGrain: piece.lockWoodGrain,
    });
    return {
      id: piece.id,
      widthMm: piece.widthMm,
      heightMm: piece.heightMm,
      materialId: piece.materialId,
      materialName: piece.materialName,
      thicknessMm: piece.thicknessMm,
      allowRotation: allowRotationForPiece(piece, settings),
      grainDirection: layoutGrain ?? "none",
      originalIndex: index,
    };
  });
  const fallbackSheet: V3Sheet = {
    index: 0,
    widthMm: settings.sheetWidthMm,
    heightMm: settings.sheetHeightMm,
    thicknessMm: settings.sheetThicknessMm,
  };
  const nestingSheets: Nesting3Sheet[] = (sheets.length ? sheets : [fallbackSheet]).map((sheet) => ({
    index: sheet.index,
    widthMm: Math.max(1, sheet.widthMm - margin * 2),
    heightMm: Math.max(1, sheet.heightMm - margin * 2),
    materialId: sheet.materialId,
    materialName: sheet.materialName,
    thicknessMm: sheet.thicknessMm,
  }));
  const result = runHybridNesting(nestingPieces, nestingSheets, { kerfMm });
  const placements: V3Placement[] = result.placements.map((placement) => ({
    pieceId: placement.pieceId,
    sheetIndex: placement.sheetIndex,
    xMm: placement.xMm + margin,
    yMm: placement.yMm + margin,
    rotated: placement.rotated === true,
  }));
  return {
    placements,
    unplacedPieceIds: result.unplacedPieceIds,
    sheetsUsed: result.sheetsUsed,
  };
}

export function runNestingV3AutoLayout(
  pieces: V3Piece[],
  sheets: V3Sheet[],
  settings: NestingV3Settings
): V3AutoLayoutResult {
  if (pieces.length === 0) return { placements: [], unplacedPieceIds: [], sheetsUsed: 0 };

  if (settings.enableV3IndustrialAutoLayout === false) {
    return runNestingV3AutoLayoutLegacy(pieces, sheets, settings);
  }

  const baseState: NestingV3State = {
    sheets: sheets.length > 0 ? sheets : [defaultSheetFromSettings(settings)],
    pieces,
    placements: [],
    unplacedPieceIds: pieces.map((p) => p.id),
    settings,
    kerfMm: settings.kerfMm,
    activeSheetIndex: 0,
  };

  return runV3IndustrialAutoLayoutPipeline(baseState);
}

export function hasOverlap(
  p: V3Placement,
  pw: number,
  ph: number,
  others: Array<{ pl: V3Placement; w: number; h: number }>,
  kerfMm: number
): boolean {
  const margin = kerfMm * 0.5;
  for (const { pl, w, h } of others) {
    if (pl.sheetIndex !== p.sheetIndex) continue;
    const overlapX = p.xMm + pw > pl.xMm + margin && pl.xMm + w > p.xMm + margin;
    const overlapY = p.yMm + ph > pl.yMm + margin && pl.yMm + h > p.yMm + margin;
    if (overlapX && overlapY) return true;
  }
  return false;
}

export function calcSheetUtilization(
  sheetIndex: number,
  sheet: V3Sheet,
  placements: V3Placement[],
  pieces: V3Piece[]
): number {
  const sheetArea = sheet.widthMm * sheet.heightMm;
  if (sheetArea === 0) return 0;
  const usedArea = placements
    .filter((p) => p.sheetIndex === sheetIndex)
    .reduce((sum, p) => {
      const piece = pieces.find((pc) => pc.id === p.pieceId);
      if (!piece) return sum;
      const { w, h } = effectiveDims(piece);
      return sum + w * h;
    }, 0);
  return Math.min(100, (usedArea / sheetArea) * 100);
}

export function rotateHoles(
  holes: Array<{ x: number; y: number; diameter: number; depth: number; holeType?: string }>,
  rotation: 0 | 90 | 180 | 270,
  pieceWidthOriginal: number,
  pieceHeightOriginal: number
) {
  return holes.map((h) => {
    const off = transformHoleLocalToPlacementOffset(
      h.x,
      h.y,
      rotation,
      pieceWidthOriginal,
      pieceHeightOriginal
    );
    return { ...h, x: off.px, y: off.py };
  });
}

const MATERIAL_COLORS: Record<string, string> = {
  mdf_branco: "#e8e4df",
  carvalho: "#c4934a",
  nogueira: "#7a4f2e",
  melamina: "#d4cec9",
};

const FALLBACK_COLORS = ["#c4934a", "#8fb4c8", "#a8c48a", "#c4a4a4", "#b8a8c4", "#9ab8a4"];

export function getPieceColor(materialId?: string, pieceIndex = 0): string {
  if (materialId) {
    const key = Object.keys(MATERIAL_COLORS).find((k) => materialId.toLowerCase().includes(k));
    if (key) return MATERIAL_COLORS[key];
  }
  return FALLBACK_COLORS[pieceIndex % FALLBACK_COLORS.length];
}
