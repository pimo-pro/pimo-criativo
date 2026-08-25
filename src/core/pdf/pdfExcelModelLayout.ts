/**
 * Dimensões extraídas do modelo oficial test.xlsx (folha «LC - Paineis»).
 * Proporções de coluna Excel A–T escaladas para A4 landscape com margens 4 mm.
 * NEST → CNC (requisito PIMO); No ETQ = ID industrial curto (sem truncar).
 */

import type jsPDF from "jspdf";

export const PDF_INDUSTRIAL_MARGIN = 4;
export const PDF_INDUSTRIAL_PAGE_W = 297;
export const PDF_INDUSTRIAL_PAGE_H = 210;
export const PDF_INDUSTRIAL_TABLE_W = PDF_INDUSTRIAL_PAGE_W - PDF_INDUSTRIAL_MARGIN * 2;
export const PDF_INDUSTRIAL_FOOTER_Y = PDF_INDUSTRIAL_PAGE_H - PDF_INDUSTRIAL_MARGIN;

/** Larguras Excel (unidades de carácter) — folha LC - Paineis, cols A–T. */
const EXCEL_COL_UNITS_TECNICO = [
  69, 64, 14.140625, 13.7109375, 14.7109375, 14.7109375, 14.7109375, 7.42578125, 7.28515625,
  4.5703125, 4.5703125, 4.5703125, 4.5703125, 4.5703125, 4.5703125, 4.5703125, 4.5703125,
  4.5703125, 21, 20.7109375,
] as const;

const ETQ_COL_INDEX = 19;
/** Largura mínima da coluna ETQ (ID industrial curto, ex. kcnc1ld). */
const ETQ_MIN_CHARS = 12;
const ETQ_SAMPLE = "kcnc1ldxxxxx";

/** @deprecated Truncamento removido — mantido para imports legados. */
export const PDF_INDUSTRIAL_ETQ_MAX_CHARS = Number.POSITIVE_INFINITY;

export const PDF_INDUSTRIAL_QTD_COL_WIDTH = 13.1;
export const PDF_INDUSTRIAL_ESP_COL_WIDTH = 14.1;

/** Altura de linha de dados (~40 linhas/página de continuação). */
export const PDF_INDUSTRIAL_ROW_MIN_H = 4.6;
/** Cabeçalho de tabela — Excel row 20/21 ≈ 19.5 pt. */
export const PDF_INDUSTRIAL_HEAD_ROW_MIN_H = 6.9;

/** Calcula largura mínima mm para a coluna ETQ (@ fontSize helvetica). */
export function measureEtqColumnWidthMm(doc: jsPDF, fontSize = 6.5): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  const w = doc.getTextWidth(ETQ_SAMPLE.slice(0, ETQ_MIN_CHARS));
  return Math.ceil(w + 2.5);
}

function scaleExcelColumnsToTable(
  units: readonly number[],
  tableW: number,
  etqIndex: number,
  etqMinMm: number
): number[] {
  const raw = [...units];
  const sum = raw.reduce((a, b) => a + b, 0);
  let mm = raw.map((u) => (u / sum) * tableW);
  const etqDelta = Math.max(0, etqMinMm - mm[etqIndex]);
  if (etqDelta > 0) {
    mm[etqIndex] = etqMinMm;
    const othersSum = mm.reduce((a, b, i) => (i === etqIndex ? a : a + b), 0);
    const shrink = (othersSum - etqDelta) / othersSum;
    mm = mm.map((v, i) => (i === etqIndex ? v : v * shrink));
  }
  return mm.map((v) => Math.round(v * 10) / 10);
}

/** Larguras das 20 colunas do técnico (mm) — soma ≈ TABLE_W. */
export function buildTecnicoColumnWidthsMm(doc: jsPDF): number[] {
  const etqMin = measureEtqColumnWidthMm(doc);
  return scaleExcelColumnsToTable(EXCEL_COL_UNITS_TECNICO, PDF_INDUSTRIAL_TABLE_W, ETQ_COL_INDEX, etqMin);
}

/** Larguras cutlist (9 cols, sem coluna Caixa) — ETQ última. */
export function buildCutlistColumnWidthsMm(doc: jsPDF): number[] {
  const etqMin = measureEtqColumnWidthMm(doc);
  const units = [52, 13.7109375, 26, 16, 10, 10, 12, 38, 20.7109375];
  return scaleExcelColumnsToTable(units, PDF_INDUSTRIAL_TABLE_W, 8, etqMin);
}

/** Cabeçalhos técnico — ordem Excel A–T (NEST→CNC). */
export const PDF_TECNICO_TABLE_HEAD = [
  "REF PEÇA",
  "MATERIAL",
  "Mat. Ref.",
  "QTD",
  "COMP",
  "LARG",
  "ESP",
  "CNC",
  "Drill",
  "O2",
  "O3",
  "O4",
  "O5",
  "F2",
  "F3",
  "F4",
  "F5",
  "GO",
  "OBSERVAÇÕES",
  "No ETQ",
] as const;

export const PDF_TECNICO_COL_COUNT = PDF_TECNICO_TABLE_HEAD.length;
