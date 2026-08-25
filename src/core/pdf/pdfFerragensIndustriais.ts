import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ProjectIndustrialFerragens } from "../industriais/buildIndustrialFerragensForProject";
import {
  assertIndustrialOutputAuthorized,
  registerIndustrialRequiredArtifact,
} from "../industrial/industrialOutputGuard";
import { formatIndustrialDesignDate } from "./pdfIndustrialListShell";

const MARGIN = 14;
const FONT_SIZE = 11;
const LINE_HEIGHT_FACTOR = 1.2;
const GRID_COLOR: [number, number, number] = [0, 0, 0];

/** Sem coluna Caixa (embutida no nome completo da peça); N QR = buildIndustrialId. */
const FERRAGENS_TABLE_HEAD = [
  ["Peça", "Ferragem", "Qtd", "Material", "N QR", "Observações"],
];

function formatGeneratedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return formatIndustrialDesignDate();
  return d.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function ferragensTableBody(data: ProjectIndustrialFerragens): string[][] {
  if (data.rows.length === 0) {
    return [["—", "Sem ferragens", "0", "—", "—", "—"]];
  }
  return data.rows.map((r) => [
    r.peca,
    r.ferragem,
    String(r.qtd),
    r.material,
    r.nQr,
    r.observacoes,
  ]);
}

function drawFerragensIndustriaisTable(
  doc: jsPDF,
  data: ProjectIndustrialFerragens,
  startY: number
): void {
  autoTable(doc, {
    head: FERRAGENS_TABLE_HEAD,
    body: ferragensTableBody(data),
    startY,
    styles: {
      font: "helvetica",
      fontSize: FONT_SIZE,
      textColor: [0, 0, 0],
      lineColor: GRID_COLOR,
      lineWidth: 0.12,
      cellPadding: 1.8,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      lineColor: GRID_COLOR,
    },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    margin: { left: MARGIN, right: MARGIN },
    theme: "grid",
  });
}

export type FerragensIndustriaisPdfSectionOptions = {
  includePageBreak?: boolean;
  includeHeader?: boolean;
};

/** Desenha secção de ferragens industriais num documento existente (ex.: PDF unificado). */
export function appendFerragensIndustriaisSection(
  doc: jsPDF,
  data: ProjectIndustrialFerragens,
  options?: FerragensIndustriaisPdfSectionOptions
): void {
  const includePageBreak = options?.includePageBreak ?? true;
  const includeHeader = options?.includeHeader ?? true;

  if (includePageBreak) {
    doc.addPage("a4", "portrait");
  }

  let y = MARGIN;
  doc.setTextColor(0, 0, 0);

  if (includeHeader) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Ferragens Industriais — Resumo Geral", MARGIN, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONT_SIZE);
    const lineStep = (FONT_SIZE * LINE_HEIGHT_FACTOR * 25.4) / 72;
    doc.text(`Projeto: ${data.projectName}`, MARGIN, y);
    y += lineStep;
    doc.text(`Código: ${data.projectCode}`, MARGIN, y);
    y += lineStep;
    doc.text(`Data: ${formatGeneratedDate(data.generatedAt)}`, MARGIN, y);
    y += lineStep * 1.2;
  }

  drawFerragensIndustriaisTable(doc, data, y);
}

export function buildFerragensIndustriaisPdf(data: ProjectIndustrialFerragens): jsPDF {
  assertIndustrialOutputAuthorized("pdf-ferragens-industriais");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  appendFerragensIndustriaisSection(doc, data, {
    includePageBreak: false,
    includeHeader: true,
  });
  registerIndustrialRequiredArtifact("pdf-ferragens-industriais");
  return doc;
}
