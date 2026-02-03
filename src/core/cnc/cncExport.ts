/**
 * Interface unificada para exportação CNC (TCN + KDT).
 */

import type { CutLayoutResult } from "../cutlayout/cutLayoutTypes";
import type { CncDrillOperation, CncExportResult, CncPanel } from "./cncTypes";
import { generateTcn } from "./tcnGenerator";
import { generateKdt } from "./kdtGenerator";

export function exportCncFiles(
  _project: unknown,
  layoutResult: CutLayoutResult,
  drillOperations: CncDrillOperation[]
): CncExportResult {
  const firstSheet = layoutResult.sheets[0]?.sheet;
  const panel: CncPanel = {
    largura_mm: firstSheet?.largura_mm ?? 2750,
    altura_mm: firstSheet?.altura_mm ?? 1830,
    espessura_mm: firstSheet?.espessura_mm ?? 19,
    materialId: firstSheet?.materialId,
  };

  return {
    tcn: generateTcn(layoutResult),
    kdt: generateKdt(panel, drillOperations),
  };
}

/**
 * Operações básicas de furação (placeholder):
 * 4 furos nos cantos de cada peça.
 */
export function buildBasicDrillOperations(layoutResult: CutLayoutResult): CncDrillOperation[] {
  const ops: CncDrillOperation[] = [];
  for (const sheet of layoutResult.sheets) {
    for (const pl of sheet.placements) {
      const x = pl.x_mm;
      const y = pl.y_mm;
      const w = pl.largura_mm;
      const h = pl.altura_mm;
      const margin = 25;
      const points: Array<{ x: number; y: number }> = [
        { x: x + margin, y: y + margin },
        { x: x + w - margin, y: y + margin },
        { x: x + w - margin, y: y + h - margin },
        { x: x + margin, y: y + h - margin },
      ];
      points.forEach((p) => {
        ops.push({
          x: p.x,
          y: p.y,
          z: 0,
          diametro: 5,
          profundidade: 10,
          tipo: "vertical",
        });
      });
    }
  }
  return ops;
}
