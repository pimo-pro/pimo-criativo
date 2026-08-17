/**
 * Late-Sheet Deterministic Compactor — Nesting Engine 2.3
 *
 * Estratégia geométrica explícita ("papel e lápis") para recompactar
 * chapas tardias com desperdício elevado.
 *
 * Puro: sem efeitos colaterais no pipeline TCN.
 * Usa apenas tipos já existentes na camada de nesting.
 *
 * SEGURANÇA DE ROTAÇÃO:
 *   Peças reconstituídas a partir de CutPlacement perdem o campo grainDirection.
 *   Para evitar rotação incorreta, placementToPiece sinaliza conservadoramente
 *   com grainDirection='length', impedindo canRotate de aprovar rotação.
 */

import type { CutPiece, CutPlacement, SheetDefinition, SheetResult } from "../cutLayoutTypes";

const EPS = 0.001;

/** Número de chapas tardias a considerar para recompactação (configurável). */
export const LATE_SHEET_COMPACT_WINDOW = 6;

/**
 * Rácio mínimo de desperdício médio nas chapas tardias para ativar o compactor.
 * Alinhado com a classificação industrial: Fraca = desperdício > 15%.
 * Anteriormente 0.13.
 */
export const LATE_SHEET_MIN_WASTE_RATIO = 0.15;

/**
 * Rácio de desperdício abaixo do qual uma chapa é "Boa" e não pode ser
 * recompactada mesmo que caia dentro da janela tardia.
 */
const COMPACTOR_STABLE_THRESHOLD = 0.12;

export type LateSheetSortStrategy = "area_desc" | "height_desc";

export type LateSheetCompactorConfig = {
  /** Espessura de corte em mm. */
  kerf: number;
  /** Quantas das últimas chapas considerar para recompactação. Padrão: 6. */
  lateSheetWindow?: number;
  /** Rácio mínimo de desperdício médio para ativar. Padrão: 0.13. */
  minWasteRatioToTrigger?: number;
};

export type LateSheetCompactorResult = {
  sheets: SheetResult[];
  wasteArea: number;
  sortStrategy: LateSheetSortStrategy;
};

/**
 * Converte um CutPlacement de volta para CutPiece com dimensões originais.
 * Define grainDirection='length' para bloquear rotação no compactor
 * (conservador: sem info de grain no placement → não arrisca rotação incorreta).
 */
export function placementToPiece(p: CutPlacement): CutPiece {
  const isRotated = p.rotacao === 90;
  return {
    largura_mm: isRotated ? p.altura_mm : p.largura_mm,
    altura_mm: isRotated ? p.largura_mm : p.altura_mm,
    espessura_mm: Number(p.espessura_mm) > 0 ? Number(p.espessura_mm) : 0,
    quantidade: 1,
    boxId: p.boxId,
    partName: p.partName,
    materialId: p.materialId,
    materialName: p.materialName,
    drillHoles: p.originalDrillHoles ?? p.drillHoles,
    holes: p.originalDrillHoles ?? p.holes,
    originalDrillHoles: p.originalDrillHoles ?? p.drillHoles,
    pieceNumber: p.pieceNumber,
    shortCode: p.shortCode,
    metadata: p.metadata,
    // Bloqueia rotação no compactor: sem grainDirection no placement,
    // sinalizamos conservadoramente 'length' para não arriscar rotação incorreta.
    grainDirection: "length",
  };
}

function canRotate(piece: CutPiece): boolean {
  if (piece.grainDirection) return false;
  const holes = piece.drillHoles ?? piece.holes ?? [];
  if (holes.some((h) => h.topDrillable === false)) return false;
  if (Math.abs(piece.largura_mm - piece.altura_mm) < EPS) return false;
  return true;
}

type ShelfRow = { y: number; height: number; nextX: number };

function makePlacement(
  piece: CutPiece,
  x: number,
  y: number,
  orient: { w: number; h: number; rotation: 0 | 90 },
  sheetIndex: number
): CutPlacement {
  const srcHoles = piece.originalDrillHoles ?? piece.drillHoles ?? piece.holes;
  const placedHoles =
    orient.rotation === 90 && srcHoles?.length
      ? srcHoles.map((h) => ({ ...h, x: h.y, y: piece.largura_mm - h.x }))
      : srcHoles;

  return {
    x_mm: x,
    y_mm: y,
    largura_mm: orient.w,
    altura_mm: orient.h,
    espessura_mm: piece.espessura_mm,
    rotacao: orient.rotation,
    sheetIndex,
    boxId: piece.boxId,
    partName: piece.partName,
    materialId: piece.materialId,
    materialName: piece.materialName,
    drillHoles: placedHoles,
    holes: placedHoles,
    originalDrillHoles: srcHoles,
    pieceNumber: piece.pieceNumber,
    shortCode: piece.shortCode,
    metadata: piece.metadata,
    outerPolygonMm: piece.outerPolygonMm,
    innerContours: piece.innerContours,
  };
}

function sortPieces(pieces: CutPiece[], strategy: LateSheetSortStrategy): CutPiece[] {
  const copy = [...pieces];
  if (strategy === "area_desc") {
    copy.sort(
      (a, b) =>
        b.largura_mm * b.altura_mm - a.largura_mm * a.altura_mm ||
        Math.max(b.largura_mm, b.altura_mm) - Math.max(a.largura_mm, a.altura_mm)
    );
  } else {
    // height_desc: maior lado primeiro
    copy.sort(
      (a, b) =>
        Math.max(b.largura_mm, b.altura_mm) - Math.max(a.largura_mm, a.altura_mm) ||
        b.largura_mm * b.altura_mm - a.largura_mm * a.altura_mm
    );
  }
  return copy;
}

function shelfPack(
  pieces: CutPiece[],
  sheet: SheetDefinition,
  kerf: number,
  baseSheetIndex: number
): { sheets: SheetResult[]; unplaced: CutPiece[] } {
  const W = sheet.largura_mm;
  const H = sheet.altura_mm;
  const allSheets: SheetResult[] = [];
  let remaining = [...pieces];

  // Anti-loop: máximo de iterações = número de peças (pior caso: 1 por chapa)
  for (let iter = 0; iter <= remaining.length && remaining.length > 0; iter++) {
    const placements: CutPlacement[] = [];
    const unplacedThisSheet: CutPiece[] = [];
    const shelves: ShelfRow[] = [];
    let currentY = 0;

    for (const piece of remaining) {
      let placed = false;

      const orientations: Array<{ w: number; h: number; rotation: 0 | 90 }> = [
        { w: piece.largura_mm, h: piece.altura_mm, rotation: 0 },
      ];
      if (canRotate(piece)) {
        orientations.push({ w: piece.altura_mm, h: piece.largura_mm, rotation: 90 });
      }

      // 1. Tenta encaixar numa prateleira existente
      outerShelf: for (const orient of orientations) {
        for (const shelf of shelves) {
          if (orient.h > shelf.height + EPS) continue;
          if (shelf.nextX + orient.w > W + EPS) continue;
          placements.push(
            makePlacement(piece, shelf.nextX, shelf.y, orient, allSheets.length + baseSheetIndex)
          );
          shelf.nextX += orient.w + kerf;
          placed = true;
          break outerShelf;
        }
      }

      // 2. Tenta nova prateleira
      if (!placed) {
        for (const orient of orientations) {
          if (currentY + orient.h > H + EPS) continue;
          if (orient.w > W + EPS) continue;
          const newShelf: ShelfRow = { y: currentY, height: orient.h, nextX: orient.w + kerf };
          shelves.push(newShelf);
          currentY += orient.h + kerf;
          placements.push(
            makePlacement(piece, 0, newShelf.y, orient, allSheets.length + baseSheetIndex)
          );
          placed = true;
          break;
        }
      }

      if (!placed) unplacedThisSheet.push(piece);
    }

    if (placements.length === 0) break; // nenhuma peça cabe — termina para evitar loop infinito

    allSheets.push({ sheet, placements });
    remaining = unplacedThisSheet;
  }

  return { sheets: allSheets, unplaced: remaining };
}

function totalWaste(sheets: SheetResult[], sheetArea: number): number {
  const used = sheets.reduce(
    (acc, s) => acc + s.placements.reduce((a, p) => a + p.largura_mm * p.altura_mm, 0),
    0
  );
  return sheets.length * sheetArea - used;
}

/**
 * Compacta um conjunto de peças usando estratégia determinística de faixas (shelves).
 * Testa "area_desc" e "height_desc" e devolve o resultado com menor desperdício.
 *
 * @param pieces         Peças a colocar (quantidade=1 cada).
 * @param sheet          Definição de chapa.
 * @param kerf           Espessura de corte em mm.
 * @param baseSheetIndex Índice base para sheetIndex nos placements gerados.
 */
export function compactLateSheets(
  pieces: CutPiece[],
  sheet: SheetDefinition,
  kerf: number,
  baseSheetIndex = 0
): LateSheetCompactorResult | null {
  if (pieces.length === 0) return null;

  const sheetArea = Math.max(1, sheet.largura_mm * sheet.altura_mm);
  const strategies: LateSheetSortStrategy[] = ["area_desc", "height_desc"];
  let best: LateSheetCompactorResult | null = null;

  for (const strategy of strategies) {
    const sorted = sortPieces(pieces, strategy);
    const { sheets } = shelfPack(sorted, sheet, kerf, baseSheetIndex);
    if (sheets.length === 0) continue;
    const waste = totalWaste(sheets, sheetArea);
    if (
      !best ||
      waste < best.wasteArea ||
      (waste === best.wasteArea && sheets.length < best.sheets.length)
    ) {
      best = { sheets, wasteArea: waste, sortStrategy: strategy };
    }
  }

  return best;
}

/**
 * Tenta recompactar as chapas tardias de um run existente.
 *
 * Extrai os placements das últimas `lateSheetWindow` chapas, converte-os
 * em CutPiece[], corre o compactor com duas estratégias de ordenação e
 * compara com o resultado original.
 *
 * Decisão: usa o resultado compactado se wasteArea < waste original.
 * Caso contrário, mantém as chapas tardias originais intactas.
 *
 * @returns  Objeto com `earlySheets`, `lateSheets` e `improved`.
 *           Null se o grupo tiver poucas chapas ou desperdício insuficiente.
 */
export function tryCompactLateSheetsOfRun(
  runSheets: SheetResult[],
  sheet: SheetDefinition,
  kerf: number,
  config: LateSheetCompactorConfig
): { earlySheets: SheetResult[]; lateSheets: SheetResult[]; improved: boolean } | null {
  const window = Math.max(1, config.lateSheetWindow ?? LATE_SHEET_COMPACT_WINDOW);
  const minWaste = config.minWasteRatioToTrigger ?? LATE_SHEET_MIN_WASTE_RATIO;

  // Grupos pequenos não justificam recompactação
  if (runSheets.length <= window) return null;

  const earlySheets = runSheets.slice(0, runSheets.length - window);
  const lateSheets = runSheets.slice(runSheets.length - window);

  const sheetArea = Math.max(1, sheet.largura_mm * sheet.altura_mm);
  const lateWaste = totalWaste(lateSheets, sheetArea);
  const lateTotal = lateSheets.length * sheetArea;
  const lateWasteRatio = lateTotal > 0 ? lateWaste / lateTotal : 0;

  // Ativa apenas se o desperdício médio nas chapas tardias justificar (≥ Fraca)
  if (lateWasteRatio < minWaste) return null;


  // ── Protecção de chapas boas dentro da janela tardia ───────────────────────
  // Chapas boas (≤ 12% desperdício) que caem dentro da janela tardia
  // são retiradas do repack e preservadas intactas.
  const stableInLate: SheetResult[] = [];
  const weakInLate: SheetResult[] = [];
  for (const ls of lateSheets) {
    const lsArea = Math.max(1, ls.sheet.largura_mm * ls.sheet.altura_mm);
    const lsUsed = ls.placements.reduce((acc, p) => acc + p.largura_mm * p.altura_mm, 0);
    const lsWaste = Math.max(0, (lsArea - lsUsed) / lsArea);
    if (lsWaste <= COMPACTOR_STABLE_THRESHOLD) {
      stableInLate.push(ls);
      console.log(`[COMPACTOR] Chapa boa protegida dentro da janela tardia (desperdício=${(lsWaste * 100).toFixed(1)}%)`);
    } else {
      weakInLate.push(ls);
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  // Converte placements → CutPiece (conservadoramente — sem rotação)
  // Apenas as chapas Fracas da janela são recompactadas.
  const piecesToCompact = weakInLate.length > 0 ? weakInLate : lateSheets;
  const latePieces = piecesToCompact.flatMap((s) => s.placements.map(placementToPiece));
  const baseIndex = earlySheets.length;
  const compacted = compactLateSheets(latePieces, sheet, kerf, baseIndex);

  if (!compacted) return null;

  // Comparar apenas com o desperdício das chapas Fracas (as que foram reempacotadas)
  const weakWaste = totalWaste(piecesToCompact, sheetArea);
  const improved = compacted.wasteArea < weakWaste;

  console.log(
    `[COMPACTOR] late-sheet repack: weakSheets=${piecesToCompact.length} | stableProtected=${stableInLate.length} | ` +
      `originalWaste=${weakWaste.toFixed(0)}mm² | compactedWaste=${compacted.wasteArea.toFixed(0)}mm² | ` +
      `improved=${improved} | strategy=${compacted.sortStrategy}`
  );

  // Resultado: chapas protegidas (earlySheets + boas da janela) + chapas fracas recompactadas
  const finalLateSheets = improved ? compacted.sheets : piecesToCompact;
  return {
    earlySheets: [...earlySheets, ...stableInLate],
    lateSheets: finalLateSheets,
    improved,
  };
}
