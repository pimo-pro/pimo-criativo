import { cutlistToPieces, runCutLayout, type CutLayoutEngineOptions, type CutlistItemForPieces } from "../cutlayout/cutLayoutEngine";
import type { CutLayoutResult, SheetDefinition } from "../cutlayout/cutLayoutTypes";
import { exportCncFiles } from "./cncExport";
import { getLayoutKerfMmForCncNesting } from "./tcnGenerator";
import { getSettings } from "../settings/settingsService";
import { listMaterials, getMaterialByIdOrLabel } from "../materials/service";
import {
  formatIndustrialThicknessIssue,
  resolveIndustrialThicknesses,
} from "./industrialThicknessResolution";
import { sanitizeIndustrialFileToken } from "./industrialNestingGroup";
import { applyRotationGeometryToSheets } from "../cutlayout/utils/cutLayoutGeomRotation";
import { isDrawerFrontPieceTipo } from "../drill/xmlMachineRouting";
import { usesOfficialMdbLaminadoSheet } from "../materials/materials.api";

/** Opções de nesting alinhadas ao TCN: kerf = minSpacing (entre contornos) + 2×raio da fresa. */
export function getDefaultCncLayoutOptions(sheet?: SheetDefinition): CutLayoutEngineOptions {
  return {
    kerf_mm: getLayoutKerfMmForCncNesting(getSettings()),
    sheetLargura_mm: sheet?.largura_mm,
    sheetAltura_mm: sheet?.altura_mm,
    groupByThicknessOnly: true,
    minUtilizationPercent: 0.9,
    rotationPreferenceMode: "aggressive",
    rotationWeight: 1.2,
    rotationPenalty: 0.15,
    scoreModel: "v32",
    // Nesting industrial multi-solução:
    // - múltiplos starts independentes (ordens de peças distintas)
    // - combinações de heurísticas skyline/shelf/guillotine + first/best fit
    // - meta-heurística com LNS + simulated annealing para escolher melhor solução final
    useMetaHeuristics: true,
    metaHeuristics: {
      enabled: true,
      iterations: 420,
      multiStartCount: 24,
      lnsDestroyRatio: 0.26,
      initialTemperature: 1.0,
      coolingRate: 0.968,
      seedBase: 1337,
    },
    collectDiagnostics: true,
  };
}

export function getFastCncLayoutOptions(sheet?: SheetDefinition): CutLayoutEngineOptions {
  return {
    kerf_mm: getLayoutKerfMmForCncNesting(getSettings()),
    sheetLargura_mm: sheet?.largura_mm,
    sheetAltura_mm: sheet?.altura_mm,
    groupByThicknessOnly: true,
    minUtilizationPercent: 0.75,
    rotationPreferenceMode: "aggressive",
    rotationWeight: 0.8,
    rotationPenalty: 0.35,
    scoreModel: "legacy",
    strategyTrials: [{ strategy: "skyline", binHeuristic: "firstFit" }],
    useMetaHeuristics: false,
    collectDiagnostics: false,
  };
}

export function getSheetDefinitionFromSettings(): SheetDefinition {
  const runtimeSettings = getSettings();
  return {
    largura_mm: runtimeSettings.materiais.sheetWidthMm,
    altura_mm: runtimeSettings.materiais.sheetHeightMm,
    espessura_mm: runtimeSettings.materiais.sheetThicknessMm,
    materialName: runtimeSettings.materiais.sheetName,
  };
}

function enrichPiecesWithMaterialSheetDimensions(pieces: import("../cutlayout/cutLayoutTypes").CutPiece[]) {
  return pieces.map((piece) => {
    const materialRecord = piece.materialId ? getMaterialByIdOrLabel(String(piece.materialId)) : null;
    if (!materialRecord) return piece;
    return {
      ...piece,
      sheetWidthMm:
        piece.sheetWidthMm && piece.sheetWidthMm > 0
          ? piece.sheetWidthMm
          : Number(materialRecord.sheetWidthMm) > 0
            ? Number(materialRecord.sheetWidthMm)
            : piece.sheetWidthMm,
      sheetHeightMm:
        piece.sheetHeightMm && piece.sheetHeightMm > 0
          ? piece.sheetHeightMm
          : Number(materialRecord.sheetHeightMm) > 0
            ? Number(materialRecord.sheetHeightMm)
            : piece.sheetHeightMm,
      sheetThicknessMm:
        piece.sheetThicknessMm && piece.sheetThicknessMm > 0
          ? piece.sheetThicknessMm
          : piece.espessura_mm,
    };
  });
}

type IndustrialMeta = {
  drillHoles?: Array<{ x: number; y: number; diameter: number; depth: number; holeType?: string; topDrillable?: boolean }>;
  metadata?: Record<string, unknown>;
  pieceNumber?: number;
  shortCode?: string;
  espessura_mm?: number;
};

function applyIndustrialRules(items: CutlistItemForPieces[]): CutlistItemForPieces[] {
  // As regras industriais já são calculadas no cutlist paramétrico; aqui só preservamos o payload.
  return items.map((item) => ({ ...item }));
}

function applyDrillHoles(items: CutlistItemForPieces[]): CutlistItemForPieces[] {
  return items.map((item) => {
    const drill = (item as unknown as { drillHoles?: unknown }).drillHoles;
    if (Array.isArray(drill) && drill.length > 0) return item;
    const legacyHoles = (item as unknown as { holes?: unknown }).holes;
    if (!Array.isArray(legacyHoles) || legacyHoles.length === 0) return item;
    return { ...item, drillHoles: legacyHoles as CutlistItemForPieces["drillHoles"] };
  });
}

/**
 * Frentes de gaveta: nesting/corte CNC mantém-se; furação TCN é proibida.
 * Todos os furos/rasgos da frente ficam exclusivos da estação DRILL.
 */
export function stripDrawerFrontHolesForCnc(items: CutlistItemForPieces[]): CutlistItemForPieces[] {
  return items.map((item) => {
    const tipo = String((item as unknown as { tipo?: unknown }).tipo ?? "");
    if (!isDrawerFrontPieceTipo(tipo)) return item;
    const next = { ...item, drillHoles: [] as CutlistItemForPieces["drillHoles"] };
    if ("holes" in next) {
      (next as unknown as { holes?: unknown }).holes = [];
    }
    return next;
  });
}

function applyCutlistMetadata(items: CutlistItemForPieces[]): CutlistItemForPieces[] {
  return items.map((item) => {
    const existing = (item as unknown as { metadata?: Record<string, unknown> }).metadata;
    const metadata: Record<string, unknown> = {
      ...(existing ?? {}),
      tipo: (item as unknown as { tipo?: unknown }).tipo ?? null,
      sourceType: (item as unknown as { sourceType?: unknown }).sourceType ?? null,
      grainDirection: (item as unknown as { grainDirection?: unknown }).grainDirection ?? null,
    };
    return { ...item, metadata };
  });
}

function pieceKey(value: {
  boxId?: string;
  partName?: string;
  largura_mm?: number;
  altura_mm?: number;
  pieceNumber?: number;
  shortCode?: string;
}): string {
  const pieceNumber = Number(value.pieceNumber ?? 0) || 0;
  const shortCode = String(value.shortCode ?? "");
  if (pieceNumber > 0 || shortCode) {
    return `id:${pieceNumber}:${shortCode}`;
  }
  return `geom:${value.boxId ?? ""}:${value.partName ?? ""}:${Math.round(Number(value.largura_mm ?? 0))}:${Math.round(Number(value.altura_mm ?? 0))}`;
}

export function buildTcnExportBaseName(
  layoutResult: CutLayoutResult,
  panelIndex: number,
  totalFiles: number
): string {
  const sheetResult = layoutResult.sheets[panelIndex - 1];
  const materialLabel =
    sheetResult?.sheet.materialName ?? sheetResult?.sheet.materialId ?? "Sheet";
  const safeMaterialName = sanitizeIndustrialFileToken(String(materialLabel));
  return totalFiles === 1 ? safeMaterialName : `${safeMaterialName}_${panelIndex}`;
}

export function buildCncFromCutlistItems(
  project: unknown,
  items: CutlistItemForPieces[],
  _sheet?: SheetDefinition,
  layoutOptions: CutLayoutEngineOptions = getDefaultCncLayoutOptions()
) {
  try {
    if (items.length === 0) {
      return null;
    }
    const industrialItems = applyCutlistMetadata(
      stripDrawerFrontHolesForCnc(applyDrillHoles(applyIndustrialRules(items)))
    );
    const thicknessResolution = resolveIndustrialThicknesses(industrialItems, listMaterials());
    if (thicknessResolution.unresolved.length > 0) {
      throw new Error(
        `Matéria-prima sem chapa válida: ${thicknessResolution.unresolved
          .map(formatIndustrialThicknessIssue)
          .join("; ")}`
      );
    }
    const cncItems = thicknessResolution.items;

    const baseSheet = _sheet ?? getSheetDefinitionFromSettings();

    const rawPieces = cutlistToPieces(cncItems);
    if (rawPieces.length === 0) {
      return null;
    }
    const pieces = enrichPiecesWithMaterialSheetDimensions(rawPieces);
    // MDB/TAMPO: não forçar a chapa das settings (2800×2070); o layout usa 3660×630.
    const mdbOnly =
      pieces.length > 0 &&
      pieces.every((piece) => usesOfficialMdbLaminadoSheet(piece.materialId ?? piece.materialName));
    const { sheetLargura_mm: optionSheetW, sheetAltura_mm: optionSheetH, ...layoutOptionsRest } = layoutOptions;
    const enforcedLayoutOptions: CutLayoutEngineOptions = mdbOnly
      ? {
          ...layoutOptionsRest,
          kerf_mm: getLayoutKerfMmForCncNesting(getSettings()),
          groupByThicknessOnly: true,
        }
      : {
          ...layoutOptions,
          kerf_mm: getLayoutKerfMmForCncNesting(getSettings()),
          groupByThicknessOnly: true,
          sheetLargura_mm: optionSheetW ?? baseSheet.largura_mm,
          sheetAltura_mm: optionSheetH ?? baseSheet.altura_mm,
        };

    const metaByPieceKey = new Map<string, IndustrialMeta>();
    for (const p of pieces) {
      metaByPieceKey.set(
        pieceKey({
          boxId: p.boxId,
          partName: p.partName,
          largura_mm: p.largura_mm,
          altura_mm: p.altura_mm,
          pieceNumber: p.pieceNumber,
          shortCode: p.shortCode,
        }),
        {
          drillHoles: p.drillHoles ?? p.holes,
          metadata: p.metadata,
          pieceNumber: p.pieceNumber,
          shortCode: p.shortCode,
          espessura_mm: p.espessura_mm,
        }
      );
    }

    const layoutResult = runCutLayout(pieces, baseSheet, enforcedLayoutOptions);
    const enrichedSheets = layoutResult.sheets.map((s) => ({
      ...s,
      placements: s.placements.map((pl) => {
        const meta = metaByPieceKey.get(
          pieceKey({
            boxId: pl.boxId,
            partName: pl.partName,
            largura_mm: pl.largura_mm,
            altura_mm: pl.altura_mm,
            pieceNumber: pl.pieceNumber,
            shortCode: pl.shortCode,
          })
        );
        if (!meta) return pl;
        return {
          ...pl,
          espessura_mm: pl.espessura_mm ?? meta.espessura_mm,
          holes: pl.holes ?? meta.drillHoles,
          drillHoles: pl.drillHoles ?? meta.drillHoles,
          metadata: pl.metadata ?? meta.metadata,
          pieceNumber: pl.pieceNumber ?? meta.pieceNumber,
          shortCode: pl.shortCode ?? meta.shortCode,
        };
      }),
    }));
    const finalLayoutResult: CutLayoutResult = {
      ...layoutResult,
      sheets: enrichedSheets,
    };
    applyRotationGeometryToSheets(finalLayoutResult.sheets);
    const cnc = exportCncFiles(project, finalLayoutResult, []);
    return { pieces, layoutResult: finalLayoutResult, cnc };
  } catch (err) {
    console.error("[CNC-ERROR] Erro no pipeline:", err);
    throw err;
  }
}

