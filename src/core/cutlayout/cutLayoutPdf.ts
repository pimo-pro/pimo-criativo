/**
 * PDF do Layout de Corte — uma página por chapa.
 * Desenho das peças (retângulos), dimensões, identificação, kerf visível.
 */

import jsPDF from "jspdf";
import type { CutLayoutResult, SheetResult } from "./cutLayoutTypes";

const MARGIN = 14;
const DRAW_W = 180;
const DRAW_H = 250;

/**
 * Gera PDF do layout de corte.
 */
export function buildCutLayoutPdf(result: CutLayoutResult): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const totalByMaterial = new Map<string, number>();
  const renderedByMaterial = new Map<string, number>();

  const materialKey = (sheet: SheetResult["sheet"]) =>
    `${sheet.materialId ?? sheet.materialName ?? "Material"}|${sheet.espessura_mm}`;

  result.sheets.forEach((sheet) => {
    const key = materialKey(sheet.sheet);
    totalByMaterial.set(key, (totalByMaterial.get(key) ?? 0) + 1);
  });

  for (let i = 0; i < result.sheets.length; i++) {
    if (i > 0) doc.addPage("a4", "portrait");
    const sheet = result.sheets[i];
    const key = materialKey(sheet.sheet);
    const current = (renderedByMaterial.get(key) ?? 0) + 1;
    renderedByMaterial.set(key, current);
    renderSheetPage(doc, sheet, i + 1, current, totalByMaterial.get(key) ?? 1);
  }

  return doc;
}

function renderSheetPage(
  doc: jsPDF,
  sheetResult: SheetResult,
  sheetNumber: number,
  materialIndex: number,
  materialTotal: number
): void {
  const { sheet, placements } = sheetResult;

  let y = MARGIN;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`Layout de Corte — Chapa ${sheetNumber}`, MARGIN, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Material: ${sheet.materialName ?? sheet.materialId ?? "—"} | Espessura: ${sheet.espessura_mm} mm | Chapa ${materialIndex}/${materialTotal}`,
    MARGIN,
    y
  );
  y += 6;
  doc.text(
    `Dimensões: ${sheet.largura_mm} × ${sheet.altura_mm} mm | Peças nesta chapa: ${placements.length}`,
    MARGIN,
    y
  );
  y += 12;

  const scaleX = DRAW_W / sheet.largura_mm;
  const scaleY = DRAW_H / sheet.altura_mm;
  const scale = Math.min(scaleX, scaleY, 1);
  const drawW = sheet.largura_mm * scale;
  const drawH = sheet.altura_mm * scale;
  const originX = MARGIN;
  const originY = y;

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.rect(originX, originY, drawW, drawH);
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`${sheet.largura_mm}×${sheet.altura_mm} mm`, originX + drawW / 2 - 15, originY - 2);
  doc.setTextColor(0, 0, 0);

  for (const pl of placements) {
    const px = originX + pl.x_mm * scale;
    const py = originY + pl.y_mm * scale;
    const pw = pl.largura_mm * scale;
    const ph = pl.altura_mm * scale;

    doc.setDrawColor(30, 64, 175);
    doc.setFillColor(239, 246, 255);
    doc.setLineWidth(0.25);
    doc.rect(px, py, pw, ph, "FD");

    const label = `${pl.partName}`.slice(0, 12);
    const dimLabel = `${Math.round(pl.largura_mm)}×${Math.round(pl.altura_mm)}`;
    if (pw > 15 && ph > 8) {
      doc.setFontSize(6);
      doc.setTextColor(30, 64, 175);
      doc.text(label, px + 2, py + ph / 2 - 2);
      doc.text(dimLabel, px + 2, py + ph / 2 + 2);
      if (pl.rotacao === 90) {
        doc.text("90°", px + pw - 8, py + 6);
      }
      doc.setTextColor(0, 0, 0);
    }
  }

  y = originY + drawH + 10;

  doc.setFontSize(9);
  doc.text(
    `Escala: 1:${Math.max(1, Math.round(1 / scale))} | Kerf visível pelo espaçamento entre peças`,
    MARGIN,
    y
  );
}
