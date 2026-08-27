/**
 * SSOT monetização de chapas oficiais: Σ (€/m² do material da chapa × área total da chapa).
 * Usado pelo ADMIN (Unificado) e pelo Relatório (productionRelease).
 * Não executa nesting — só precifica sheets já determinadas.
 */

import { getPrecoPorMaterial } from "../pricing/pricing";

export type ChapasSheetForPricing = {
  material: string;
  espessuraMm: number;
  sheetLarguraMm: number;
  sheetAlturaMm: number;
};

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function priceChapasSheetsEur(
  sheets: ReadonlyArray<ChapasSheetForPricing>
): { totalEur: number; sheetCount: number } {
  let totalEur = 0;
  const list = sheets ?? [];
  for (const sheet of list) {
    const L = Number(sheet.sheetLarguraMm) || 0;
    const A = Number(sheet.sheetAlturaMm) || 0;
    const areaM2 = (Math.max(0, L) / 1000) * (Math.max(0, A) / 1000);
    const eurM2 = getPrecoPorMaterial(
      String(sheet.material ?? ""),
      Number(sheet.espessuraMm) || 0
    );
    totalEur = round2(totalEur + eurM2 * areaM2);
  }
  return { totalEur, sheetCount: list.length };
}
