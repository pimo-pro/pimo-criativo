/**
 * Layout partilhado — PDFs industriais (técnico, cutlist, unificado).
 * Baseado no modelo test.xlsx (LC - Paineis): margens 4 mm, tabela full-width.
 */

import type jsPDF from "jspdf";
import {
  PDF_INDUSTRIAL_MARGIN,
  PDF_INDUSTRIAL_PAGE_W,
  PDF_INDUSTRIAL_TABLE_W,
  PDF_INDUSTRIAL_FOOTER_Y,
  PDF_INDUSTRIAL_ROW_MIN_H,
  PDF_INDUSTRIAL_HEAD_ROW_MIN_H,
} from "./pdfExcelModelLayout";
import {
  drawLogoIndustrialInBox,
  getCachedLogoIndustrialDataUrl,
  LOGO_INDUSTRIAL_SIZE_MM,
} from "./logoIndustrialPublic";

export {
  PDF_INDUSTRIAL_MARGIN,
  PDF_INDUSTRIAL_PAGE_W,
  PDF_INDUSTRIAL_TABLE_W,
  PDF_INDUSTRIAL_ROW_MIN_H,
  PDF_INDUSTRIAL_HEAD_ROW_MIN_H,
  PDF_INDUSTRIAL_QTD_COL_WIDTH,
  PDF_INDUSTRIAL_ESP_COL_WIDTH,
  PDF_INDUSTRIAL_ETQ_MAX_CHARS,
} from "./pdfExcelModelLayout";

export const PDF_INDUSTRIAL_HEADER_COLOR: [number, number, number] = [15, 23, 42];
export const PDF_INDUSTRIAL_ROW_ALT: [number, number, number] = [245, 245, 245];
export const PDF_INDUSTRIAL_GRID_LINE: [number, number, number] = [0, 0, 0];
export const PDF_INDUSTRIAL_GRID_WIDTH = 0.12;

export const PDF_OPERATIONAL_STAGES = ["CORTE manual", "ORLAGEM", "MONTAGEM"] as const;

export type IndustrialPdfHeaderInfo = {
  designer: string;
  designDate: string;
  responsible?: string;
  logoDataUrl?: string | null;
};

export type IndustrialProjectBlockInfo = {
  projectName: string;
  acabamento: string;
  boxCount: number;
  totalPieces: number;
};

/** Cabeçalho compacto — logo industrial 10×10 + PIMO + Designer + Responsável + Data. */
export function drawIndustrialPdfTitleHeader(doc: jsPDF, info: IndustrialPdfHeaderInfo): number {
  const y = PDF_INDUSTRIAL_MARGIN;
  const logoSize = LOGO_INDUSTRIAL_SIZE_MM;
  const logoDataUrl =
    info.logoDataUrl !== undefined ? info.logoDataUrl : getCachedLogoIndustrialDataUrl();

  drawLogoIndustrialInBox(doc, logoDataUrl, PDF_INDUSTRIAL_MARGIN, y, logoSize);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text("PIMO", PDF_INDUSTRIAL_MARGIN + logoSize + 2, y + logoSize * 0.65);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  const responsible = info.responsible ?? "khaled";
  const infoRight = `Designer: ${info.designer}     Responsável: ${responsible}     Data de design: ${info.designDate}`;
  doc.text(
    infoRight,
    PDF_INDUSTRIAL_PAGE_W - PDF_INDUSTRIAL_MARGIN - doc.getTextWidth(infoRight),
    y + logoSize * 0.65
  );
  doc.setTextColor(0, 0, 0);
  return y + logoSize + 4;
}

export function drawIndustrialProjectInfoBlock(
  doc: jsPDF,
  startY: number,
  info: IndustrialProjectBlockInfo
): { nextY: number; totalPiecesLabelPos: { x: number; y: number } } {
  const blockW = PDF_INDUSTRIAL_TABLE_W;
  const blockX = PDF_INDUSTRIAL_MARGIN;
  const rowH = 5;
  const infoH = rowH * 2;
  const blockY = startY;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.rect(blockX, blockY, blockW, infoH);
  doc.line(blockX, blockY + rowH, blockX + blockW, blockY + rowH);
  doc.line(blockX + blockW / 2, blockY, blockX + blockW / 2, blockY + infoH);

  const c1x = blockX + 2;
  const c2x = blockX + blockW / 2 + 2;

  const boldLabel = (label: string, lx: number, ly: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(label, lx, ly);
  };
  const normalVal = (val: string, lx: number, ly: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(val, lx, ly);
  };

  let iy = blockY + rowH - 1.2;
  boldLabel("PROJETO / MOVEL:", c1x, iy);
  normalVal(info.projectName || "Projeto", c1x + doc.getTextWidth("PROJETO / MOVEL:") + 1.5, iy);
  boldLabel("Acabamento:", c2x, iy);
  normalVal(info.acabamento, c2x + doc.getTextWidth("Acabamento:") + 1.5, iy);

  iy += rowH;
  boldLabel("No. de Caixas:", c1x, iy);
  normalVal(String(info.boxCount), c1x + doc.getTextWidth("No. de Caixas:") + 1.5, iy);
  boldLabel("Pecas Total:", c2x, iy);
  const totalPecasPos = { x: c2x + doc.getTextWidth("Pecas Total:") + 1.5, y: iy };

  return { nextY: blockY + infoH + 0.5, totalPiecesLabelPos: totalPecasPos };
}

export function drawIndustrialOperationalDatesBlock(
  doc: jsPDF,
  blockX: number,
  blockY: number,
  blockW: number,
  c1x: number,
  c2x: number
): number {
  const etapas = PDF_OPERATIONAL_STAGES;
  const dateRowH = 5;
  const dateBlockH = etapas.length * dateRowH;
  const midDateX = blockX + blockW / 2;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.rect(blockX, blockY, blockW, dateBlockH);
  doc.line(midDateX, blockY, midDateX, blockY + dateBlockH);

  for (let i = 0; i < etapas.length; i++) {
    const rowY = blockY + i * dateRowH;
    if (i > 0) {
      doc.setLineWidth(0.12);
      doc.line(blockX, rowY, blockX + blockW, rowY);
    }
    const textY = rowY + dateRowH - 1.4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(etapas[i], c1x, textY);
    const labelW = doc.getTextWidth(etapas[i]);
    doc.setFont("helvetica", "normal");
    doc.text("  inicio:", c1x + labelW, textY);
    const siW = doc.getTextWidth("  inicio:");
    doc.setLineWidth(0.15);
    doc.line(c1x + labelW + siW + 0.5, textY + 0.2, c1x + labelW + siW + 22, textY + 0.2);
    doc.text(" h:", c1x + labelW + siW + 24, textY);
    const hW = doc.getTextWidth(" h:");
    doc.line(c1x + labelW + siW + 24 + hW + 0.5, textY + 0.2, c1x + labelW + siW + 24 + hW + 10, textY + 0.2);

    doc.text("fim:", c2x, textY);
    const fW = doc.getTextWidth("fim:");
    doc.line(c2x + fW + 0.5, textY + 0.2, c2x + fW + 22, textY + 0.2);
    doc.text(" h:", c2x + fW + 24, textY);
    doc.line(c2x + fW + 24 + hW + 0.5, textY + 0.2, c2x + fW + 24 + hW + 10, textY + 0.2);
  }

  return blockY + dateBlockH;
}

export function drawIndustrialSectionTitle(doc: jsPDF, y: number, title: string): number {
  const blockX = PDF_INDUSTRIAL_MARGIN;
  doc.setFillColor(200, 200, 200);
  doc.rect(blockX, y, PDF_INDUSTRIAL_TABLE_W, 4.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(title, blockX + (PDF_INDUSTRIAL_TABLE_W - doc.getTextWidth(title)) / 2, y + 3.2);
  return y + 5;
}

export function drawIndustrialPdfFooter(
  doc: jsPDF,
  designDate: string,
  numRefs: number,
  totalPecas: number
): void {
  const pageCount = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(140, 140, 140);
    doc.text(
      `PIMO  |  ${designDate}  |  ${numRefs} ref.  |  ${totalPecas} pecas  |  pag. ${p}/${pageCount}`,
      PDF_INDUSTRIAL_MARGIN,
      PDF_INDUSTRIAL_FOOTER_Y
    );
  }
  doc.setTextColor(0, 0, 0);
}

export function getIndustrialAutoTableStyles() {
  return {
    fontSize: 6.5,
    cellPadding: { top: 0.4, right: 0.5, bottom: 0.4, left: 0.5 },
    lineColor: PDF_INDUSTRIAL_GRID_LINE,
    lineWidth: PDF_INDUSTRIAL_GRID_WIDTH,
    overflow: "hidden" as const,
    minCellHeight: PDF_INDUSTRIAL_ROW_MIN_H,
    valign: "middle" as const,
  };
}

export function getIndustrialAutoTableMargins() {
  return {
    left: PDF_INDUSTRIAL_MARGIN,
    right: PDF_INDUSTRIAL_MARGIN,
    top: PDF_INDUSTRIAL_MARGIN,
    bottom: PDF_INDUSTRIAL_MARGIN,
  };
}

export function getIndustrialHeadStyles() {
  return {
    fillColor: PDF_INDUSTRIAL_HEADER_COLOR,
    textColor: [255, 255, 255] as [number, number, number],
    lineColor: PDF_INDUSTRIAL_GRID_LINE,
    lineWidth: PDF_INDUSTRIAL_GRID_WIDTH,
    fontSize: 6.5,
    fontStyle: "bold" as const,
    minCellHeight: PDF_INDUSTRIAL_HEAD_ROW_MIN_H,
    cellPadding: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 },
  };
}

/** Estilos autoTable columnStyles a partir de array de larguras mm. */
export function buildColumnStylesFromWidths(
  widthsMm: number[],
  overrides?: Record<number, Partial<{ halign: "left" | "center" | "right" }>>
): Record<number, { cellWidth: number; overflow: "hidden"; halign?: "left" | "center" | "right" }> {
  const styles: Record<number, { cellWidth: number; overflow: "hidden"; halign?: "left" | "center" | "right" }> = {};
  widthsMm.forEach((w, i) => {
    styles[i] = {
      cellWidth: w,
      overflow: "hidden",
      ...overrides?.[i],
    };
  });
  return styles;
}

export function applyEtqCellStyle(data: unknown, etqColIndex: number): void {
  const hook = data as {
    section: string;
    column: { index: number };
    cell: { styles: Record<string, unknown> };
  };
  if (hook.section === "body" && hook.column.index === etqColIndex) {
    hook.cell.styles.overflow = "hidden";
    hook.cell.styles.fontSize = 6.5;
  }
}

export function formatIndustrialDesignDate(): string {
  return new Date().toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Pass-through — ID industrial é curto; sem truncamento. */
export function formatEtqForPdf(value: string): string {
  return String(value ?? "");
}
