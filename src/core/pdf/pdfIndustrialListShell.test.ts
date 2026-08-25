import { describe, expect, it } from "vitest";
import jsPDF from "jspdf";
import {
  PDF_INDUSTRIAL_MARGIN,
  PDF_INDUSTRIAL_TABLE_W,
  PDF_TECNICO_COL_COUNT,
  buildTecnicoColumnWidthsMm,
  measureEtqColumnWidthMm,
} from "./pdfExcelModelLayout";
import { PDF_OPERATIONAL_STAGES, formatIndustrialDesignDate } from "./pdfIndustrialListShell";

describe("pdfExcelModelLayout", () => {
  it("margens 4 mm e tabela full-width A4 landscape", () => {
    expect(PDF_INDUSTRIAL_MARGIN).toBe(4);
    expect(PDF_INDUSTRIAL_TABLE_W).toBe(289);
  });

  it("colunas técnico somam largura útil da página", () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const widths = buildTecnicoColumnWidthsMm(doc);
    expect(widths).toHaveLength(PDF_TECNICO_COL_COUNT);
    const sum = widths.reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThan(PDF_INDUSTRIAL_TABLE_W - 1);
    expect(sum).toBeLessThanOrEqual(PDF_INDUSTRIAL_TABLE_W + 1);
  });

  it("No ETQ comporta ID industrial curto (ex. kcnc1ld)", () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const etqW = measureEtqColumnWidthMm(doc);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    const sample = "kcnc1ldxxxxx";
    expect(etqW).toBeGreaterThanOrEqual(doc.getTextWidth(sample));
  });
});

describe("pdfIndustrialListShell", () => {
  it("etapas operacionais sem FOLHEAGEM, CNC nem NESTING", () => {
    expect(PDF_OPERATIONAL_STAGES).toEqual(["CORTE manual", "ORLAGEM", "MONTAGEM"]);
    expect(PDF_OPERATIONAL_STAGES.join(" ")).not.toMatch(/FOLHEAGEM|CNC|NESTING|DISCO/i);
  });

  it("formatIndustrialDesignDate devolve data pt-PT", () => {
    const d = formatIndustrialDesignDate();
    expect(d).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});
