/**
 * Converte bundles do nesting PRO (por material+espessura) em ChapasRealSummary.
 * Não executa nesting — só lê layoutResult já calculado pelo pipeline TCN/PRO.
 */

import type { CutlistItemForPieces } from "../cutlayout/cutLayoutEngine";
import type { CutLayoutResult } from "../cutlayout/cutLayoutTypes";
import type { CutListItemComPreco } from "../types";
import { CHAPA_PADRAO_ALTURA, CHAPA_PADRAO_LARGURA } from "../manufacturing/materials";
import type { PerThicknessLayoutBundle } from "../fabrication/industrialPerThicknessPipeline";
import {
  resolveChapasRealPieceRow,
  type ChapasRealSheetRow,
  type ChapasRealSummary,
} from "./computeChapasReal";

/** Campos mínimos do bundle PRO necessários para o summary (sem cncBundle). */
export type ProLayoutBundleForChapas = Pick<
  PerThicknessLayoutBundle,
  "thicknessMm" | "materialLabel" | "items" | "layoutResult"
>;

export type BuildChapasSummaryFromProBundlesInput = {
  bundles: ReadonlyArray<ProLayoutBundleForChapas>;
  projectName: string;
  boxes: Array<{ id: string; nome?: string }>;
};

/**
 * Agrega sheets de todos os grupos material+espessura num único ChapasRealSummary.
 * mode = "real" (mesma semântica de monetização actual); diagnostic marca origem PRO.
 */
export function buildChapasSummaryFromProBundles(
  input: BuildChapasSummaryFromProBundlesInput
): ChapasRealSummary {
  const projectName = String(input.projectName ?? "").trim() || "Projeto";
  const boxes = input.boxes ?? [];
  const bundles = input.bundles ?? [];

  const sheets: ChapasRealSheetRow[] = [];
  const mergedLayoutSheets: CutLayoutResult["sheets"] = [];
  let sheetIndex = 0;

  for (const bundle of bundles) {
    const layoutSheets = bundle.layoutResult?.sheets ?? [];
    if (layoutSheets.length === 0) continue;

    const materialLabel = String(bundle.materialLabel ?? "").trim() || "Material";
    const thicknessMm =
      Number.isFinite(bundle.thicknessMm) && bundle.thicknessMm > 0
        ? bundle.thicknessMm
        : 18;
    const groupItems = (bundle.items ?? []) as CutListItemComPreco[];

    for (const sheetResult of layoutSheets) {
      sheetIndex += 1;
      const sheetW = sheetResult.sheet.largura_mm || CHAPA_PADRAO_LARGURA;
      const sheetH = sheetResult.sheet.altura_mm || CHAPA_PADRAO_ALTURA;
      const sheetArea = sheetW * sheetH;
      const usedArea = sheetResult.placements.reduce(
        (s, p) => s + p.largura_mm * p.altura_mm,
        0
      );
      const waste = Math.max(0, sheetArea - usedArea);

      sheets.push({
        sheetIndex,
        espessuraMm: thicknessMm || sheetResult.sheet.espessura_mm || 18,
        material: materialLabel,
        sheetLarguraMm: sheetW,
        sheetAlturaMm: sheetH,
        pieceCount: sheetResult.placements.length,
        usedAreaMm2: usedArea,
        sheetAreaMm2: sheetArea,
        wasteMm2: waste,
        wastePct: sheetArea > 0 ? (waste / sheetArea) * 100 : 0,
        pieces: sheetResult.placements.map((p) =>
          resolveChapasRealPieceRow(p, groupItems, projectName, boxes)
        ),
      });

      mergedLayoutSheets.push({
        ...sheetResult,
        sheet: {
          ...sheetResult.sheet,
          materialName: materialLabel,
          espessura_mm: thicknessMm || sheetResult.sheet.espessura_mm,
        },
      });
    }
  }

  if (sheets.length === 0) {
    return {
      totalSheets: 0,
      totalWasteMm2: 0,
      totalWastePct: 0,
      sheets: [],
      layout: null,
      mode: "vazio",
      diagnostics: ["bundles PRO sem sheets — nada a publicar como oficial"],
    };
  }

  const totalWaste = sheets.reduce((s, r) => s + r.wasteMm2, 0);
  const totalArea = sheets.reduce((s, r) => s + r.sheetAreaMm2, 0);

  return {
    totalSheets: sheets.length,
    totalWasteMm2: totalWaste,
    totalWastePct: totalArea > 0 ? (totalWaste / totalArea) * 100 : 0,
    sheets,
    layout: { sheets: mergedLayoutSheets },
    mode: "oficial_pro",
    diagnostics: ["origem=oficial_pro"],
  };
}

/** Contagem oficial = soma de sheets em todos os bundles (paridade com nº de TCN). */
export function countSheetsFromProBundles(
  bundles: ReadonlyArray<Pick<ProLayoutBundleForChapas, "layoutResult">>
): number {
  return (bundles ?? []).reduce(
    (n, b) => n + (b.layoutResult?.sheets?.length ?? 0),
    0
  );
}

/** Re-export útil para tipagem nos call sites (passo 6). */
export type { CutlistItemForPieces };
