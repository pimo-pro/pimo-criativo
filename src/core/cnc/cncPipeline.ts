import { cutlistToPieces, runCutLayout, type CutLayoutEngineOptions, type CutlistItemForPieces } from "../cutlayout/cutLayoutEngine";
import type { SheetDefinition } from "../cutlayout/cutLayoutTypes";
import { exportCncFiles } from "./cncExport";
import { getSettings } from "../settings/settingsService";
import { PANEL_DEFAULTS } from "../panel/panelConstants";

export const DEFAULT_CNC_SHEET: SheetDefinition = {
  largura_mm: PANEL_DEFAULTS.largura_mm,
  altura_mm: PANEL_DEFAULTS.altura_mm,
  espessura_mm: PANEL_DEFAULTS.espessura_mm,
};

export const DEFAULT_CNC_LAYOUT_OPTIONS: CutLayoutEngineOptions = {
  kerf_mm: 15,
  groupByThicknessOnly: false,
  rotationPreferenceMode: "aggressive",
  rotationWeight: 0.8,
  rotationPenalty: 0.45,
};

export function getSheetDefinitionFromSettings(): SheetDefinition {
  const runtimeSettings = getSettings();
  return {
    largura_mm: runtimeSettings.materiais.sheetWidthMm,
    altura_mm: runtimeSettings.materiais.sheetHeightMm,
    espessura_mm: runtimeSettings.materiais.sheetThicknessMm,
    materialName: runtimeSettings.materiais.sheetName,
  };
}

export function buildCncFromCutlistItems(
  project: unknown,
  items: CutlistItemForPieces[],
  sheet?: SheetDefinition,
  layoutOptions: CutLayoutEngineOptions = DEFAULT_CNC_LAYOUT_OPTIONS
) {
  const resolvedSheet: SheetDefinition = sheet ?? getSheetDefinitionFromSettings();
  const pieces = cutlistToPieces(items);
  if (pieces.length === 0) {
    return null;
  }

  const enforcedLayoutOptions: CutLayoutEngineOptions = {
    ...layoutOptions,
    kerf_mm: 15,
  };
  const layoutResult = runCutLayout(pieces, resolvedSheet, enforcedLayoutOptions);
  const cnc = exportCncFiles(project, layoutResult, []);
  return { pieces, layoutResult, cnc };
}

