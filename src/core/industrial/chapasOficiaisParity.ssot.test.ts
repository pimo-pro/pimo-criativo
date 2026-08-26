/**
 * Passo 12 — paridade SSOT: N TCN/sheets PRO = Unificado/Admin = Relatório = PDF armazém.
 * Não corre nesting/export TCN (protegidos): publica bundles no formato real do pipeline.
 *
 * buildBundlesForItems: agrupa com groupCutlistItemsByMaterialAndThickness (igual ao TCN)
 * e empacota por área (first-fit) na chapa padrão — N emerge das peças, sem targetN fixo.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearAllCutlistCache } from "../manufacturing/cutlistFromBoxes";
import { CHAPA_PADRAO_ALTURA, CHAPA_PADRAO_LARGURA } from "../manufacturing/materials";
import { listIndustrialMaterialsSnapshot, listMaterials } from "../materials/service";
import { defaultRulesConfig } from "../rules/rulesConfig";
import { settingsDefaults } from "../settings/settingsSchema";
import { setIndustrialSettingsReadOverride } from "../settings/settingsStorage";
import type { CutlistItemForPieces } from "../cutlayout/cutLayoutEngine";
import type { CutLayoutResult } from "../cutlayout/cutLayoutTypes";
import type { BoxModule } from "../types";
import { buildCutlistItemsForIndustrialExport } from "../fabrication/buildCutlistItemsForIndustrialExport";
import {
  computeFinanceiroUnificado,
  financeiroMetricRows,
} from "../financeiro/financeiroUnificado";
import { resolvePaineisOrigem } from "../projectReport/financeiroOverrides";
import { aggregateChapasByEspessura } from "../projectReport/chapasReport";
import {
  groupCutlistItemsByMaterialAndThickness,
  resolveMaterialLabelForCutlistItem,
  sortMaterialThicknessGroupKeys,
} from "../cnc/industrialThicknessGroups";
import { inferCutlistItemThicknessMm } from "../cnc/industrialNestingGroup";
import { computeConsumoMateriais } from "./computeConsumoMateriais";
import { computeChapasReal } from "./computeChapasReal";
import { clearChapasOficiaisPro } from "./chapasOficiaisProStore";
import { publishChapasOficiaisFromProBundles } from "./chapasOficiaisPublish";
import type { ProLayoutBundleForChapas } from "./chapasSummaryFromProBundles";

const PROJECT = "Paridade SSOT Chapas N";

function enableChapasReaisMode(): void {
  setIndustrialSettingsReadOverride({
    ...settingsDefaults,
    orcamentos: {
      ...settingsDefaults.orcamentos,
      custosIndustriais: {
        ...settingsDefaults.orcamentos.custosIndustriais,
        materialCostMode: "por_chapas_reais",
      },
    },
  });
}

/** Caixa com costa 10 mm → cutlist multi-espessura via builder industrial real. */
function boxParidade(): BoxModule {
  return {
    id: "box-par",
    nome: "CAIXA_PARIDADE",
    dimensoes: { largura: 600, altura: 720, profundidade: 560 },
    espessura: 19,
    portaTipo: "sem_porta",
    gavetas: 0,
    prateleiras: 2,
    doorsLayer: [],
    drawersLayer: [],
    costaAtiva: true,
    material: "mdf_branco",
  } as unknown as BoxModule;
}

type PackedPiece = {
  largura_mm: number;
  altura_mm: number;
  boxId: string;
  partName: string;
  area: number;
};

function expandItemUnits(item: CutlistItemForPieces): PackedPiece[] {
  const qty = Math.max(1, Math.floor(Number(item.quantidade) || 1));
  const L = Number(item.dimensoes?.largura) || 0;
  const A = Number(item.dimensoes?.altura) || 0;
  const out: PackedPiece[] = [];
  for (let i = 0; i < qty; i += 1) {
    out.push({
      largura_mm: L,
      altura_mm: A,
      boxId: String(item.boxId ?? ""),
      partName: String(item.tipo ?? item.nome ?? "peca"),
      area: Math.max(0, L * A),
    });
  }
  return out;
}

function pieceFitsOnSheet(
  piece: PackedPiece,
  sheetW: number,
  sheetH: number,
  usedArea: number
): boolean {
  const sheetArea = sheetW * sheetH;
  if (piece.area <= 0 || piece.area > sheetArea - usedArea + 1e-6) return false;
  const fitsNormal = piece.largura_mm <= sheetW && piece.altura_mm <= sheetH;
  const fitsRotated = piece.altura_mm <= sheetW && piece.largura_mm <= sheetH;
  return fitsNormal || fitsRotated;
}

/**
 * Empacota unidades de peça em chapas por first-fit (área + cabe na geometria).
 * Não é o nesting PRO — é um packing determinístico para obter N lógico a partir das peças.
 * Uma peça maior que a chapa ocupa uma chapa sozinha (como rejeição/limite industrial).
 */
function packPiecesOntoSheets(
  pieces: PackedPiece[],
  thicknessMm: number
): CutLayoutResult["sheets"] {
  const sheetW = CHAPA_PADRAO_LARGURA;
  const sheetH = CHAPA_PADRAO_ALTURA;
  const ordered = [...pieces].sort((a, b) => b.area - a.area);
  const sheets: CutLayoutResult["sheets"] = [];

  type OpenSheet = {
    usedArea: number;
    placements: CutLayoutResult["sheets"][number]["placements"];
  };
  let open: OpenSheet | null = null;

  const flush = () => {
    if (!open || open.placements.length === 0) {
      open = null;
      return;
    }
    sheets.push({
      sheet: { largura_mm: sheetW, altura_mm: sheetH, espessura_mm: thicknessMm },
      placements: open.placements,
    });
    open = null;
  };

  for (const piece of ordered) {
    if (!open || !pieceFitsOnSheet(piece, sheetW, sheetH, open.usedArea)) {
      flush();
      open = { usedArea: 0, placements: [] };
      // Peça maior que a chapa: ainda assim cria chapa própria (1 sheet).
    }
    const sheetIndex = sheets.length;
    open!.placements.push({
      x_mm: 0,
      y_mm: open!.placements.length * 2,
      largura_mm: piece.largura_mm,
      altura_mm: piece.altura_mm,
      rotacao: 0,
      sheetIndex,
      boxId: piece.boxId,
      partName: piece.partName,
    });
    open!.usedArea += piece.area;
  }
  flush();
  return sheets;
}

/**
 * Constrói bundles no formato PRO a partir do cutlist:
 * 1) Agrupa por material+espessura (mesma chave do nesting/TCN).
 * 2) Expande quantidades em unidades.
 * 3) Empacota por área na chapa padrão → N = Σ sheets (emergente, sem targetN).
 */
function buildBundlesForItems(
  items: ReadonlyArray<CutlistItemForPieces>
): ProLayoutBundleForChapas[] {
  const materials = listMaterials();
  const groups = groupCutlistItemsByMaterialAndThickness([...items]);
  const keys = sortMaterialThicknessGroupKeys(groups.keys(), groups, materials);
  const bundles: ProLayoutBundleForChapas[] = [];

  for (const key of keys) {
    const groupItems = groups.get(key) ?? [];
    if (groupItems.length === 0) continue;
    const sample = groupItems[0]!;
    const thicknessMm = inferCutlistItemThicknessMm(sample);
    const materialLabel = resolveMaterialLabelForCutlistItem(sample, materials);
    const units = groupItems.flatMap(expandItemUnits);
    if (units.length === 0) continue;

    const layoutSheets = packPiecesOntoSheets(units, thicknessMm || 18);
    if (layoutSheets.length === 0) continue;

    bundles.push({
      thicknessMm: thicknessMm || 18,
      materialLabel,
      items: groupItems,
      layoutResult: { sheets: layoutSheets },
    });
  }

  return bundles;
}

function nSheetsFromProBundles(bundles: ReadonlyArray<ProLayoutBundleForChapas>): number {
  return bundles.reduce((s, b) => s + (b.layoutResult?.sheets?.length ?? 0), 0);
}

describe("SSOT chapas — paridade N (passo 12)", () => {
  beforeEach(() => {
    clearAllCutlistCache();
    clearChapasOficiaisPro();
    enableChapasReaisMode();
  });

  afterEach(() => {
    clearChapasOficiaisPro();
    setIndustrialSettingsReadOverride(null);
  });

  it("buildBundlesForItems: N emerge do agrupamento+packing (sem targetN)", () => {
    const boxes = [boxParidade()];
    const items = buildCutlistItemsForIndustrialExport({
      boxes,
      rules: defaultRulesConfig,
      materialId: "mdf_branco",
      projectName: PROJECT,
      remates: [],
      rodapes: [],
    }) as CutlistItemForPieces[];

    const bundles = buildBundlesForItems(items);
    const n = nSheetsFromProBundles(bundles);

    // Multi-espessura (19 + costa 10) → pelo menos 2 grupos / ou multi-sheet no 19
    expect(bundles.length).toBeGreaterThanOrEqual(1);
    expect(n).toBeGreaterThanOrEqual(1);
    // Cada bundle.thicknessMm alinhado às peças do grupo
    for (const b of bundles) {
      expect(b.layoutResult.sheets.length).toBeGreaterThan(0);
      for (const item of b.items) {
        expect(inferCutlistItemThicknessMm(item)).toBeCloseTo(b.thicknessMm, 0);
      }
    }
  });

  it("após publish PRO: N TCN/sheets = Unificado = Relatório = PDF/consumo", () => {
    const box = boxParidade();
    const boxes = [box];
    const projectName = PROJECT;

    const items = buildCutlistItemsForIndustrialExport({
      boxes,
      rules: defaultRulesConfig,
      materialId: "mdf_branco",
      projectName,
      remates: [],
      rodapes: [],
    });
    expect(items.length).toBeGreaterThan(3);

    const bundles = buildBundlesForItems(items as CutlistItemForPieces[]);
    const nTcn = nSheetsFromProBundles(bundles);
    expect(nTcn).toBeGreaterThanOrEqual(2);

    expect(
      publishChapasOficiaisFromProBundles({
        projectId: projectName,
        projectName,
        items: items as CutlistItemForPieces[],
        bundles,
        boxes: boxes.map((b) => ({ id: b.id, nome: b.nome })),
        isProMode: true,
      })
    ).toBe(true);

    // 1) PDF armazém / chapas — mesma entrada que o ZIP
    const chapasPdf = computeChapasReal(items, projectName, boxes, {
      projectId: projectName,
    });
    expect(chapasPdf.mode).toBe("oficial_pro");
    const nPdf = chapasPdf.totalSheets;

    const consumo = computeConsumoMateriais(
      items,
      listIndustrialMaterialsSnapshot(),
      projectName,
      boxes
    );
    const nConsumo = consumo.porChapa.length;

    // 2) Unificado / Admin («Nº de chapas») — mesmo builder de cutlist → mesmo fingerprint
    const snap = computeFinanceiroUnificado(
      {
        boxes,
        rules: defaultRulesConfig,
        materialId: "mdf_branco",
        projectName,
        remates: [],
        rodapes: [],
      },
      listIndustrialMaterialsSnapshot()
    );
    expect(snap.chapas.mode).toBe("oficial_pro");
    const nUnificado = snap.chapas.count;
    expect(resolvePaineisOrigem(snap)).toBe("oficial_pro");
    expect(
      financeiroMetricRows(snap).find(([k]) => k.startsWith("Nº de chapas"))?.[1]
    ).toBe(String(nTcn));

    // 3) Relatório — soma quantidades do detalhe por espessura
    const nRelatorio = aggregateChapasByEspessura(chapasPdf.sheets).reduce(
      (s, d) => s + (Number(d.quantidade) || 0),
      0
    );

    expect(nPdf).toBe(nTcn);
    expect(nUnificado).toBe(nTcn);
    expect(nRelatorio).toBe(nTcn);
    expect(nConsumo).toBe(nTcn);
  });
});
