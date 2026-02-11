/**
 * PDF Técnico — base para unificação com Cutlist.
 * Cabeçalho, resumo do projeto, página por caixa (dimensões, materiais, ferragens, observações).
 */

import jsPDF from "jspdf";
import type { BoxModule } from "../types";
import type { RulesConfig } from "../rules/rulesConfig";
import { cutlistComPrecoFromBoxes } from "../manufacturing/cutlistFromBoxes";
import { getMaterialForBox, getMaterialDisplayInfo } from "../materials/service";

export type ProjectForPdf = {
  projectName: string;
  boxes: BoxModule[];
  rules: RulesConfig;
  /** Id do material do projeto (CRUD); usado quando box não tem material próprio. */
  materialId?: string;
};

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;

/** Placeholder para QR Code (área reservada). */
function renderQrPlaceholder(doc: jsPDF, x: number, y: number, size = 20): void {
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.rect(x, y, size, size);
  doc.setFontSize(7);
  doc.setTextColor(180, 180, 180);
  doc.text("QR", x + size / 2 - 3, y + size / 2 + 2);
  doc.setTextColor(0, 0, 0);
}

/**
 * Renderiza resumo do projeto (primeira página).
 */
export function renderProjectSummary(doc: jsPDF, project: ProjectForPdf): void {
  let y = MARGIN;

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("PIMO Studio", MARGIN, y);
  y += 10;

  doc.setFontSize(14);
  doc.text(`Projeto: ${project.projectName || "Projeto"}`, MARGIN, y);
  y += 12;

  renderQrPlaceholder(doc, PAGE_W - MARGIN - 24, MARGIN, 24);
  y += 4;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Data: ${new Date().toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" })}`, MARGIN, y);
  y += 8;

  doc.text(`Total de caixas: ${project.boxes.length}`, MARGIN, y);
  y += 6;

  const cutlist = cutlistComPrecoFromBoxes(project.boxes, project.rules, project.materialId);
  const totalPecas = cutlist.reduce((s, i) => s + i.quantidade, 0);
  doc.text(`Total de peças: ${totalPecas > 0 ? totalPecas : "—"}`, MARGIN, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Resumo das caixas", MARGIN, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  project.boxes.forEach((box, i) => {
    if (y > PAGE_H - 30) {
      doc.addPage("a4", "portrait");
      y = MARGIN;
    }
    const dims = box.dimensoes;
    const materialId = getMaterialForBox(box, project.materialId);
    const matInfo = getMaterialDisplayInfo(materialId || "MDF Branco");
    doc.text(
      `${i + 1}. ${box.nome} — ${dims.largura}×${dims.altura}×${dims.profundidade} mm | ${matInfo.label} | ${box.espessura ?? matInfo.espessura} mm`,
      MARGIN,
      y
    );
    y += 6;
  });
}

/**
 * Renderiza página técnica de uma caixa.
 */
export function renderBoxTechnicalPage(
  doc: jsPDF,
  box: BoxModule,
  boxIndex: number,
  projectMaterialId?: string
): void {
  let y = MARGIN;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`Caixa ${boxIndex}: ${box.nome}`, MARGIN, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const dims = box.dimensoes;
  doc.text(`Dimensões: ${dims.largura} × ${dims.altura} × ${dims.profundidade} mm`, MARGIN, y);
  y += 7;

  const materialId = getMaterialForBox(box, projectMaterialId);
  const matInfo = getMaterialDisplayInfo(materialId || "MDF Branco");
  const espessura = box.espessura ?? matInfo.espessura;
  doc.text(`Material: ${matInfo.label} | Espessura: ${espessura} mm | Preço: ${matInfo.precoPorM2} €/m²`, MARGIN, y);
  y += 7;

  doc.text(`Tipo de borda: ${box.tipoBorda ?? "reta"} | Tipo de fundo: ${box.tipoFundo ?? "recuado"}`, MARGIN, y);
  y += 7;

  doc.text(`Prateleiras: ${box.prateleiras} | Gavetas: ${box.gavetas} | Porta: ${box.portaTipo ?? "sem_porta"}`, MARGIN, y);
  y += 12;

  doc.setFont("helvetica", "bold");
  doc.text("Ferragens", MARGIN, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  const ferragens = box.ferragens ?? [];
  if (ferragens.length === 0) {
    doc.text("— Nenhuma ferragem —", MARGIN, y);
    y += 6;
  } else {
    ferragens.forEach((f) => {
      doc.text(`• ${f.nome}: ${f.quantidade} un.`, MARGIN, y);
      y += 5;
    });
  }
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.text("Observações", MARGIN, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.text("—", MARGIN, y);
  y += 20;

  doc.setDrawColor(220, 220, 220);
  doc.rect(MARGIN, y, PAGE_W - 2 * MARGIN, 60);
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.text("Vista 3D (placeholder)", MARGIN + 4, y + 8);
  doc.setTextColor(0, 0, 0);
}

/**
 * Gera PDF técnico completo.
 */
export function buildTechnicalPdf(project: ProjectForPdf): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  renderProjectSummary(doc, project);

  project.boxes.forEach((box, i) => {
    doc.addPage("a4", "portrait");
    renderBoxTechnicalPage(doc, box, i + 1, project.materialId);
  });

  return doc;
}
