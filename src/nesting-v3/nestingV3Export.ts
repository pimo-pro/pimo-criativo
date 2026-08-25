/**
 * Nesting V3 — Exportação TCN + PDF industrial armazém.
 *
 * Usa o contrato industrial partilhado (fixedPlacementsFromV3State) antes de
 * invocar exportCncFiles — o mesmo pipeline geométrico que produção individual/lote.
 */

import type { NestingV3State } from "./nestingV3Types";
import type { CutLayoutResult } from "../core/cutlayout/cutLayoutTypes";
import type { ChapasRealSummary } from "../core/industrial/computeChapasReal";
import { resolveChapasRealPieceRow } from "../core/industrial/computeChapasReal";
import type { ConsumoMateriaisSummary } from "../core/industrial/computeConsumoMateriais";
import { exportCncFiles } from "../core/cnc/cncExport";
import type { CncExportResult } from "../core/cnc/cncTypes";
import { fixedPlacementsFromV3State } from "../core/cutlayout/integration/fixedPlacementsAdapter";
import {
  buildIndustrialArmazemPdf,
  industrialArmazemPdfFileName,
} from "../core/pdf/pdfIndustrialArmazem";
import type jsPDF from "jspdf";

/**
 * Prepara layoutResult industrial a partir do estado V3 (manual ou pós auto-layout).
 */
export function prepareNestingV3IndustrialLayout(state: NestingV3State): CutLayoutResult {
  const { result } = fixedPlacementsFromV3State(state);
  return result;
}

/** Converte layout industrial V3 → resumos usados pelo PDF armazém. */
export function chapasAndConsumoFromCutLayout(
  layout: CutLayoutResult,
  projectName = "Projeto",
  boxes: Array<{ id: string; nome?: string }> = []
): {
  chapas: ChapasRealSummary;
  consumo: ConsumoMateriaisSummary;
} {
  const sheets = (layout.sheets ?? []).map((sheetResult, idx) => {
    const sheetW = sheetResult.sheet.largura_mm ?? 0;
    const sheetH = sheetResult.sheet.altura_mm ?? 0;
    const sheetArea = sheetW * sheetH;
    const usedArea = sheetResult.placements.reduce((s, p) => s + p.largura_mm * p.altura_mm, 0);
    const waste = Math.max(0, sheetArea - usedArea);
    const pieces = sheetResult.placements.map((p) =>
      resolveChapasRealPieceRow(p, [], projectName, boxes)
    );
    return {
      sheetIndex: idx + 1,
      espessuraMm: sheetResult.sheet.espessura_mm ?? 18,
      material: sheetResult.sheet.materialName ?? "MDF",
      sheetLarguraMm: sheetW,
      sheetAlturaMm: sheetH,
      pieceCount: sheetResult.placements.length,
      usedAreaMm2: usedArea,
      sheetAreaMm2: sheetArea,
      wasteMm2: waste,
      wastePct: sheetArea > 0 ? (waste / sheetArea) * 100 : 0,
      pieces,
    };
  });

  const totalWaste = sheets.reduce((s, r) => s + r.wasteMm2, 0);
  const totalArea = sheets.reduce((s, r) => s + r.sheetAreaMm2, 0);
  const chapas: ChapasRealSummary = {
    totalSheets: sheets.length,
    totalWasteMm2: totalWaste,
    totalWastePct: totalArea > 0 ? (totalWaste / totalArea) * 100 : 0,
    sheets,
    layout,
    mode: sheets.length > 0 ? "real" : "vazio",
    diagnostics: sheets.length > 0 ? [] : ["nesting-v3: sem sheets no layout exportado"],
  };

  const porChapa = sheets.map((s) => ({
    chapaIndex: s.sheetIndex,
    material: s.material,
    espessuraMm: s.espessuraMm,
    areaUsadaMm2: s.usedAreaMm2,
    areaChapaMm2: s.sheetAreaMm2,
    desperdicioMm2: s.wasteMm2,
    desperdicioPct: s.wastePct,
  }));

  const consumo: ConsumoMateriaisSummary = {
    porPeca: sheets.flatMap((s) =>
      s.pieces.map((p, i) => ({
        pecaId: `${s.sheetIndex}-${i}`,
        peca: p.nome,
        caixa: p.boxId || "—",
        nQr: p.nQr,
        material: s.material,
        areaMm2: p.largura * p.altura,
        pesoKg: 0,
        quantidade: 1,
      }))
    ),
    porChapa,
    desperdicioTotalMm2: totalWaste,
    desperdicioTotalPct: chapas.totalWastePct,
  };

  return { chapas, consumo };
}

export async function buildNestingV3IndustrialArmazemPdf(
  state: NestingV3State,
  projectName = "NestingV3"
): Promise<jsPDF> {
  const layout = prepareNestingV3IndustrialLayout(state);
  const { chapas, consumo } = chapasAndConsumoFromCutLayout(layout);
  return buildIndustrialArmazemPdf(projectName, chapas, consumo);
}

export async function downloadNestingV3ArmazemPdf(
  state: NestingV3State,
  projectName = "NestingV3"
): Promise<void> {
  const doc = await buildNestingV3IndustrialArmazemPdf(state, projectName);
  doc.save(industrialArmazemPdfFileName(projectName));
}

/**
 * Gera ficheiros TCN a partir do estado do Nesting V3.
 * Pipeline: V3 → BL físico → finalizeIndustrialLayout(preserve-positions) → exportCncFiles.
 */
export function exportNestingV3ToCnc(
  state: NestingV3State,
  projectName = "NestingV3"
): CncExportResult {
  const layoutResult = prepareNestingV3IndustrialLayout(state);
  return exportCncFiles({ projectName }, layoutResult, []);
}

export function downloadNestingV3Tcn(state: NestingV3State, projectName = "NestingV3"): void {
  const result = exportNestingV3ToCnc(state, projectName);
  for (const file of result.files) {
    const blob = new Blob([file.tcn], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${file.filenameBase}.tcn`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export interface V3ExportStats {
  totalPieces: number;
  placedPieces: number;
  unplacedPieces: number;
  sheetsUsed: number;
  filesGenerated: number;
}

export function getV3ExportStats(state: NestingV3State): V3ExportStats {
  const sheetsWithPieces = new Set(state.placements.map((p) => p.sheetIndex));
  return {
    totalPieces: state.pieces.length,
    placedPieces: state.placements.length,
    unplacedPieces: state.unplacedPieceIds.length,
    sheetsUsed: sheetsWithPieces.size,
    filesGenerated: sheetsWithPieces.size,
  };
}
