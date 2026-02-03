/**
 * PDF Unificado — junta PDF Técnico + Cutlist em sequência.
 * Preparado para futura inclusão de layout de corte.
 */

import type jsPDF from "jspdf";
import { buildTechnicalPdf } from "./pdfTechnical";
import { buildCutlistPdf } from "./pdfCutlist";
import type { ProjectForPdf } from "./pdfTechnical";

/** ProjectForPdf compatível com pdfCutlist (extractedPartsByBoxId opcional). */
export type ProjectForPdfWithExtracted = ProjectForPdf & {
  extractedPartsByBoxId?: Record<string, Record<string, import("../types").CutListItemComPreco[]>>;
};

/**
 * Gera PDF unificado (Técnico + Cutlist em sequência).
 * Sem layout de corte por enquanto.
 */
export function buildUnifiedPdf(project: ProjectForPdfWithExtracted): jsPDF {
  const doc = buildTechnicalPdf(project);
  buildCutlistPdf(project, doc);
  return doc;
}
