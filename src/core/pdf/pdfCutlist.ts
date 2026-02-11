/**
 * PDF Cutlist — tabela de peças para corte.
 * Caixa, Peça, Dimensões, Borda (fita), Quantidade, Observações.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { BoxModule, CutListItemComPreco } from "../types";
import type { RulesConfig } from "../rules/rulesConfig";
import { cutlistComPrecoFromBoxes } from "../manufacturing/cutlistFromBoxes";

export type ProjectForPdf = {
  projectName: string;
  boxes: BoxModule[];
  rules: RulesConfig;
  materialId?: string;
  extractedPartsByBoxId?: Record<string, Record<string, CutListItemComPreco[]>>;
};

const MARGIN = 14;
const HEADER_COLOR: [number, number, number] = [15, 23, 42];

/** Junta cutlist paramétrica + peças extraídas (GLB). */
function getFullCutlist(project: ProjectForPdf): Array<CutListItemComPreco & { boxNome: string; tipoBorda?: string }> {
  const parametric = cutlistComPrecoFromBoxes(project.boxes, project.rules, project.materialId);
  const boxById = new Map(project.boxes.map((b) => [b.id, b]));

  const rows: Array<CutListItemComPreco & { boxNome: string; tipoBorda?: string }> = parametric.map((p) => {
    const box = boxById.get(p.boxId ?? "");
    return {
      ...p,
      boxNome: box?.nome ?? p.boxId ?? "—",
      tipoBorda: box?.tipoBorda,
    };
  });

  const extractedByBox = project.extractedPartsByBoxId ?? {};
  for (const box of project.boxes) {
    const byModel = extractedByBox[box.id];
    if (!byModel) continue;
    const extracted = Object.values(byModel).flat();
    for (const p of extracted) {
      rows.push({
        ...p,
        boxNome: box.nome ?? box.id,
        tipoBorda: box.tipoBorda,
      });
    }
  }

  return rows;
}

/**
 * Renderiza tabela de cutlist.
 */
export function renderCutlistTable(
  doc: jsPDF,
  parts: Array<CutListItemComPreco & { boxNome?: string; tipoBorda?: string }>,
  startY: number
): number {
  const head = ["Caixa", "Peça", "L×A×P (mm)", "Borda (fita)", "Qtd", "Observações"];
  const body = parts.map((p) => [
    p.boxNome ?? "—",
    p.nome,
    `${p.dimensoes.largura}×${p.dimensoes.altura}×${p.dimensoes.profundidade}`,
    p.tipoBorda ?? "reta",
    String(p.quantidade),
    "",
  ]);

  if (body.length === 0) {
    body.push(["Nenhuma peça", "—", "—", "—", "—", "—"]);
  }

  autoTable(doc, {
    head: [head],
    body,
    startY,
    styles: { fontSize: 9 },
    headStyles: { fillColor: HEADER_COLOR },
    margin: { left: MARGIN, right: MARGIN },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 45 },
      2: { cellWidth: 45 },
      3: { cellWidth: 28 },
      4: { cellWidth: 18 },
      5: { cellWidth: "auto" },
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY;
  return finalY;
}

/**
 * Gera PDF de cutlist.
 * @param existingDoc Se fornecido, adiciona as páginas ao documento existente.
 */
export function buildCutlistPdf(project: ProjectForPdf, existingDoc?: jsPDF): jsPDF {
  const doc = existingDoc ?? new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  if (existingDoc) {
    existingDoc.addPage("a4", "landscape");
  }

  let y = MARGIN;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Cutlist", MARGIN, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Projeto: ${project.projectName || "Projeto"}`, MARGIN, y);
  y += 6;

  doc.setFontSize(9);
  doc.text(
    `Data: ${new Date().toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" })}`,
    MARGIN,
    y
  );
  y += 12;

  const parts = getFullCutlist(project);
  y = renderCutlistTable(doc, parts, y);

  return doc;
}
