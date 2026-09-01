/**
 * Fase 7C — Compactação translacional pós-layout (sem alterar rotação nem dimensões).
 * Empurra cada peça para o mínimo (x, y) no referencial do solver (canto inferior-esquerdo),
 * mantendo limites da chapa e sem sobreposições (kerf).
 */

import type { CutPlacement, SheetDefinition, SheetResult } from "../cutLayoutTypes";
import { overlaps } from "../utils/cutLayoutUtils";

const EPS = 0.001;
/** Passo grosso — equilíbrio entre precisão e custo. */
const STEP_MM = 3;
const STEP_FINE_MM = 1;
const FINE_PASS_MAX_PIECES = 50;
const MAX_PASSES = 4;

function validPosition(
  x: number,
  y: number,
  w: number,
  h: number,
  sheet: SheetDefinition,
  others: Array<{ x: number; y: number; w: number; h: number }>,
  kerf: number
): boolean {
  if (x < -EPS || y < -EPS) return false;
  if (x + w > sheet.largura_mm + EPS || y + h > sheet.altura_mm + EPS) return false;
  return !overlaps(x, y, w, h, others, kerf);
}

function compactPlacementsOnSheet(
  placements: CutPlacement[],
  sheet: SheetDefinition,
  kerf: number
): CutPlacement[] {
  if (placements.length <= 1) return placements.map((p) => ({ ...p }));

  const order = placements
    .map((p, i) => ({ i, y: p.y_mm, x: p.x_mm, a: p.largura_mm * p.altura_mm }))
    .sort((a, b) => a.y - b.y || a.x - b.x || a.a - b.a || a.i - b.i)
    .map((x) => x.i);

  const current = placements.map((p) => ({ ...p }));

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let moved = false;
    for (const idx of order) {
      const pl = current[idx];
      const w = pl.largura_mm;
      const h = pl.altura_mm;
      const others = current
        .filter((_, j) => j !== idx)
        .map((q) => ({ x: q.x_mm, y: q.y_mm, w: q.largura_mm, h: q.altura_mm }));

      let x = pl.x_mm;
      let y = pl.y_mm;

      while (x >= STEP_MM - EPS && validPosition(x - STEP_MM, y, w, h, sheet, others, kerf)) {
        x -= STEP_MM;
        moved = true;
      }
      while (y >= STEP_MM - EPS && validPosition(x, y - STEP_MM, w, h, sheet, others, kerf)) {
        y -= STEP_MM;
        moved = true;
      }

      current[idx] = { ...pl, x_mm: x, y_mm: y };
    }
    if (!moved) break;
  }

  if (current.length <= FINE_PASS_MAX_PIECES) {
    for (const idx of order) {
      const pl = current[idx];
      const w = pl.largura_mm;
      const h = pl.altura_mm;
      const others = current
        .filter((_, j) => j !== idx)
        .map((q) => ({ x: q.x_mm, y: q.y_mm, w: q.largura_mm, h: q.altura_mm }));

      let x = pl.x_mm;
      let y = pl.y_mm;

      while (x >= STEP_FINE_MM - EPS && validPosition(x - STEP_FINE_MM, y, w, h, sheet, others, kerf)) {
        x -= STEP_FINE_MM;
      }
      while (y >= STEP_FINE_MM - EPS && validPosition(x, y - STEP_FINE_MM, w, h, sheet, others, kerf)) {
        y -= STEP_FINE_MM;
      }

      current[idx] = { ...pl, x_mm: x, y_mm: y };
    }
  }

  return current;
}

export function aplicarCompactacaoTranslacional(sheets: SheetResult[], kerf: number): SheetResult[] {
  return sheets.map((sr) => ({
    ...sr,
    placements: compactPlacementsOnSheet(sr.placements, sr.sheet, kerf),
  }));
}
