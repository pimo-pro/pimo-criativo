import type { CutListItemComPreco } from "../types";
import {
  cutlistToPieces,
  runCutLayout,
  type CutlistItemForPieces,
} from "../cutlayout/cutLayoutEngine";
import type { CutLayoutResult } from "../cutlayout/cutLayoutTypes";
import {
  getFastCncLayoutOptions,
  getSheetDefinitionFromSettings,
} from "../cnc/cncPipeline";
import {
  groupCutlistItemsByMaterialAndThickness,
  resolveMaterialLabelForCutlistItem,
  sortMaterialThicknessGroupKeys,
} from "../cnc/industrialThicknessGroups";
import { inferCutlistItemThicknessMm } from "../cnc/industrialNestingGroup";
import { resolveIndustrialThicknesses } from "../cnc/industrialThicknessResolution";
import { enrichPiecesWithMaterialSheetDimensions } from "../cnc/preparePiecesForNesting";
import { listMaterials } from "../materials/service";
import { getLayoutKerfMmForCncNesting } from "../cnc/tcnLayoutKerf";
import { getSettings } from "../settings/settingsService";
import { CHAPA_PADRAO_LARGURA, CHAPA_PADRAO_ALTURA } from "../manufacturing/materials";
import {
  MDB_LAMINADO_SHEET_HF_MM,
  MDB_LAMINADO_SHEET_LF_MM,
  usesOfficialMdbLaminadoSheet,
} from "../materials/materials.api";
import {
  resolveFullIndustrialNameForDocument,
  resolveIndustrialIdForDocument,
} from "../etiquetas/industrialDisplayName";
import { resolvePieceToken } from "../naming/industrialNaming";
import { buildChapasOficiaisFingerprint } from "./cutlistFingerprint";
import { getChapasOficiaisProValid } from "./chapasOficiaisProStore";

/** Peça dentro de uma chapa — nome completo + N QR (= etiqueta). */
export type ChapasRealPieceRow = {
  nome: string;
  boxId: string;
  nQr: string;
  largura: number;
  altura: number;
};

export type ChapasRealSheetRow = {
  sheetIndex: number;
  espessuraMm: number;
  material: string;
  sheetLarguraMm: number;
  sheetAlturaMm: number;
  pieceCount: number;
  usedAreaMm2: number;
  sheetAreaMm2: number;
  wasteMm2: number;
  wastePct: number;
  pieces: ChapasRealPieceRow[];
};

/**
 * oficial_pro = snapshot TCN/PRO (monetizável);
 * estimado = nesting fast ou área (A1: mostrar N, não monetizar);
 * vazio = sem peças;
 * real = legado (já não emitido por computeChapasReal).
 */
export type ChapasRealMode = "oficial_pro" | "estimado" | "vazio" | "real";

export type ChapasRealSummary = {
  totalSheets: number;
  totalWasteMm2: number;
  totalWastePct: number;
  sheets: ChapasRealSheetRow[];
  layout: CutLayoutResult | null;
  mode: ChapasRealMode;
  /** Motivos de fallback / grupos sem layout (observabilidade Fase 5B). */
  diagnostics: string[];
};

export type ComputeChapasRealOptions = {
  /** Chave do store (nome ou slug). Default = projectName. */
  projectId?: string | null;
};

export function isChapasRealOficial(mode: ChapasRealMode): boolean {
  return mode === "oficial_pro";
}

export function hasChapasSheets(summary: Pick<ChapasRealSummary, "sheets">): boolean {
  return (summary.sheets?.length ?? 0) > 0;
}

function emptySummary(
  partial: Partial<ChapasRealSummary> & Pick<ChapasRealSummary, "mode" | "diagnostics">
): ChapasRealSummary {
  return {
    totalSheets: 0,
    totalWasteMm2: 0,
    totalWastePct: 0,
    sheets: [],
    layout: null,
    ...partial,
  };
}

function boxNomeFromList(
  boxes: Array<{ id: string; nome?: string }>,
  boxId: string
): string {
  return boxes.find((b) => b.id === boxId)?.nome?.trim() || boxId || "—";
}

function findCutlistItemForPlacement(
  groupItems: CutListItemComPreco[],
  boxId: string,
  partName: string
): CutListItemComPreco | undefined {
  const inBox = groupItems.filter((i) => String(i.boxId ?? "") === boxId);
  const pool = inBox.length > 0 ? inBox : groupItems;
  const exact = pool.find(
    (i) => String(i.nome ?? "") === partName || String(i.tipo ?? "") === partName
  );
  if (exact) return exact;

  const partLower = partName.toLowerCase();
  const byToken = pool.find((i) => {
    const token = resolvePieceToken(String(i.tipo ?? i.nome ?? "peca")).toLowerCase();
    return (
      partLower === token ||
      partLower.endsWith(`_${token}`) ||
      partLower.endsWith(token)
    );
  });
  if (byToken) return byToken;

  return pool.length === 1 ? pool[0] : undefined;
}

/** Resolve nome completo + N QR a partir do placement e do cutlist do grupo. */
export function resolveChapasRealPieceRow(
  placement: { partName?: string; boxId?: string; largura_mm: number; altura_mm: number },
  groupItems: CutListItemComPreco[],
  projectName: string,
  boxes: Array<{ id: string; nome?: string }>
): ChapasRealPieceRow {
  const boxId = String(placement.boxId ?? "");
  const partName = String(placement.partName ?? "").trim();
  const boxNome = boxNomeFromList(boxes, boxId);
  const item = findCutlistItemForPlacement(groupItems, boxId, partName);

  let like: { nome?: string; tipo?: string; metadata?: Record<string, unknown> };
  if (item) {
    like = item;
  } else if (!partName) {
    like = { nome: "peca", tipo: "peca" };
  } else {
    // Nesting V3 / sem cutlist: partName pode ser "C1_lat_esq" — extrair token final conhecido.
    const parts = partName.split("_").filter(Boolean);
    let key = partName;
    for (let n = Math.min(3, parts.length); n >= 1; n--) {
      const candidate = parts.slice(-n).join("_");
      const token = resolvePieceToken(candidate);
      if (token === candidate.toLowerCase() || token !== candidate.replace(/\s+/g, "_").toLowerCase()) {
        key = candidate;
        break;
      }
    }
    like = { nome: key, tipo: key };
  }

  return {
    nome: resolveFullIndustrialNameForDocument(like, projectName, boxNome),
    nQr: resolveIndustrialIdForDocument(like, projectName, boxNome),
    boxId,
    largura: placement.largura_mm,
    altura: placement.altura_mm,
  };
}

/**
 * Contagem de chapas: SSOT = snapshot PRO (store) quando fingerprint bate;
 * senão nesting fast na thread principal (A1 → mode estimado, sem monetizar).
 * Não altera params industriais de sheet/kerf — só lê as mesmas funções do PRO.
 */
export function computeChapasReal(
  items: CutListItemComPreco[],
  projectName: string,
  boxes: Array<{ id: string; nome?: string }>,
  options?: ComputeChapasRealOptions
): ChapasRealSummary {
  if (items.length === 0) {
    return emptySummary({
      mode: "vazio",
      diagnostics: ["cutlist vazio — sem chapas para calcular"],
    });
  }

  const projectKey = String(options?.projectId ?? projectName ?? "").trim() || projectName;
  const fingerprint = buildChapasOficiaisFingerprint(items as CutlistItemForPieces[]);
  const proSnap = getChapasOficiaisProValid(projectKey, fingerprint);
  if (proSnap?.summary && hasChapasSheets(proSnap.summary)) {
    const prior = (proSnap.summary.diagnostics ?? []).filter(
      (d) => d !== "origem=oficial_pro" && d !== "origem=oficial_pro_store"
    );
    return {
      ...proSnap.summary,
      mode: "oficial_pro",
      diagnostics: ["origem=oficial_pro_store", ...prior],
    };
  }

  const sheetDef = getSheetDefinitionFromSettings();
  const materials = listMaterials();
  const thicknessResolution = resolveIndustrialThicknesses(
    items as CutlistItemForPieces[],
    materials
  );
  // PDF: usa itens resolvidos mesmo com unresolved (não bloqueia o relatório).
  const preparedItems = thicknessResolution.items as CutListItemComPreco[];

  const groups = groupCutlistItemsByMaterialAndThickness(preparedItems as CutlistItemForPieces[]);
  const groupKeys = sortMaterialThicknessGroupKeys(groups.keys(), groups, materials);

  const layoutOptions = {
    ...getFastCncLayoutOptions(sheetDef),
    kerf_mm: getLayoutKerfMmForCncNesting(getSettings()),
    groupByThicknessOnly: true as const,
    sheetLargura_mm: sheetDef.largura_mm,
    sheetAltura_mm: sheetDef.altura_mm,
  };

  const omitGlobalSheetOverride = (opts: typeof layoutOptions) => {
    const { sheetLargura_mm: _w, sheetAltura_mm: _h, ...rest } = opts;
    return rest;
  };

  const sheets: ChapasRealSheetRow[] = [];
  const mergedLayoutSheets: CutLayoutResult["sheets"] = [];
  const diagnostics: string[] = [];
  let sheetIndex = 0;

  if (groupKeys.length === 0) {
    diagnostics.push("nenhum grupo material+espessura após resolução de espessuras");
  }

  for (const groupKey of groupKeys) {
    const groupItems = groups.get(groupKey)!;
    if (groupItems.length === 0) continue;

    const sample = groupItems[0]!;
    const materialLabel = resolveMaterialLabelForCutlistItem(sample, materials);
    const thicknessMm = inferCutlistItemThicknessMm(sample);
    const groupLabel = `${materialLabel} ${thicknessMm || "?"}mm`;
    const groupIsMdb = groupItems.some((item) =>
      usesOfficialMdbLaminadoSheet(String(item.materialId ?? item.material ?? ""))
    );
    const groupSheetDef = groupIsMdb
      ? {
          ...sheetDef,
          largura_mm: MDB_LAMINADO_SHEET_LF_MM,
          altura_mm: MDB_LAMINADO_SHEET_HF_MM,
          espessura_mm: 30,
          materialName: materialLabel,
        }
      : sheetDef;
    const groupLayoutOptions = groupIsMdb ? omitGlobalSheetOverride(layoutOptions) : layoutOptions;

    let groupLayout: CutLayoutResult | null = null;
    try {
      const rawPieces = cutlistToPieces(groupItems, { projectName, boxes });
      if (rawPieces.length === 0) {
        diagnostics.push(`grupo "${groupLabel}": cutlistToPieces devolveu 0 peças`);
        continue;
      }
      const pieces = enrichPiecesWithMaterialSheetDimensions(rawPieces);
      groupLayout = runCutLayout(pieces, groupSheetDef, groupLayoutOptions);
      if (!groupLayout?.sheets?.length) {
        diagnostics.push(
          `grupo "${groupLabel}": runCutLayout (fast) sem sheets — ${pieces.length} peça(s)`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "erro desconhecido";
      diagnostics.push(`grupo "${groupLabel}": falha no nesting fast — ${msg}`);
      groupLayout = null;
    }

    if (!groupLayout?.sheets?.length) continue;

    for (const sheetResult of groupLayout.sheets) {
      sheetIndex += 1;
      const sheetW = sheetResult.sheet.largura_mm ?? sheetDef.largura_mm ?? CHAPA_PADRAO_LARGURA;
      const sheetH = sheetResult.sheet.altura_mm ?? sheetDef.altura_mm ?? CHAPA_PADRAO_ALTURA;
      const sheetArea = sheetW * sheetH;
      const usedArea = sheetResult.placements.reduce((s, p) => s + p.largura_mm * p.altura_mm, 0);
      const waste = Math.max(0, sheetArea - usedArea);

      sheets.push({
        sheetIndex,
        espessuraMm: thicknessMm || sheetResult.sheet.espessura_mm || sheetDef.espessura_mm || 18,
        material: materialLabel,
        sheetLarguraMm: sheetW,
        sheetAlturaMm: sheetH,
        pieceCount: sheetResult.placements.length,
        usedAreaMm2: usedArea,
        sheetAreaMm2: sheetArea,
        wasteMm2: waste,
        wastePct: sheetArea > 0 ? (waste / sheetArea) * 100 : 0,
        pieces: sheetResult.placements.map((p) =>
          resolveChapasRealPieceRow(p, groupItems as CutListItemComPreco[], projectName, boxes)
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
    const sheetArea =
      (sheetDef.largura_mm || CHAPA_PADRAO_LARGURA) * (sheetDef.altura_mm || CHAPA_PADRAO_ALTURA);
    const used = preparedItems.reduce(
      (s, i) => s + i.dimensoes.largura * i.dimensoes.altura * (i.quantidade ?? 1),
      0
    );
    const estSheets = Math.max(1, Math.ceil(used / sheetArea));
    diagnostics.unshift(
      `fallback estimado: nesting fast sem sheets[] — N≈${estSheets} por área (chapasReais€=0)`
    );
    return {
      totalSheets: estSheets,
      totalWasteMm2: estSheets * sheetArea - used,
      totalWastePct:
        estSheets * sheetArea > 0
          ? ((estSheets * sheetArea - used) / (estSheets * sheetArea)) * 100
          : 0,
      sheets: [],
      layout: null,
      mode: "estimado",
      diagnostics,
    };
  }

  const totalWaste = sheets.reduce((s, r) => s + r.wasteMm2, 0);
  const totalArea = sheets.reduce((s, r) => s + r.sheetAreaMm2, 0);
  const layout: CutLayoutResult = { sheets: mergedLayoutSheets };

  return {
    totalSheets: sheets.length,
    totalWasteMm2: totalWaste,
    totalWastePct: totalArea > 0 ? (totalWaste / totalArea) * 100 : 0,
    sheets,
    layout,
    mode: "estimado",
    diagnostics: [
      "origem=nesting_fast_a1",
      "Estimado — pode diferir do TCN final",
      ...diagnostics,
    ],
  };
}
