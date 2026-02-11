/**
 * PDF Unificado — Cutlist Industrial, Painéis, Portas, Gavetas, Ferragens, Totais, Resumo Financeiro.
 * Cada seção só é incluída se houver conteúdo real.
 */

import type jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { buildTechnicalPdf } from "./pdfTechnical";
import { buildCutlistPdf } from "./pdfCutlist";
import type { ProjectForPdf } from "./pdfTechnical";
import { cutlistComPrecoFromBoxes } from "../manufacturing/cutlistFromBoxes";
import { ferragensFromBoxes } from "../manufacturing/cutlistFromBoxes";
import {
  calcularPrecoTotalPecas,
  calcularPrecoTotalProjeto,
} from "../pricing/pricing";

/** ProjectForPdf compatível com pdfCutlist (extractedPartsByBoxId opcional). */
export type ProjectForPdfWithExtracted = ProjectForPdf & {
  extractedPartsByBoxId?: Record<string, Record<string, import("../types").CutListItemComPreco[]>>;
};

const MARGIN = 14;
const HEADER_COLOR: [number, number, number] = [15, 23, 42];

function addPainéisSection(doc: jsPDF, project: ProjectForPdfWithExtracted): void {
  if (!project.boxes.length) return;
  doc.addPage("a4", "portrait");
  let y = MARGIN;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Painéis (Caixas)", MARGIN, y);
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  project.boxes.forEach((box, i) => {
    const d = box.dimensoes;
    doc.text(
      `${i + 1}. ${box.nome} — ${d.largura}×${d.altura}×${d.profundidade} mm`,
      MARGIN,
      y
    );
    y += 6;
  });
}

function addPortasSection(doc: jsPDF, project: ProjectForPdfWithExtracted): void {
  const comPortas = project.boxes.filter(
    (b) => b.portaTipo && b.portaTipo !== "sem_porta"
  );
  if (comPortas.length === 0) return;
  doc.addPage("a4", "portrait");
  let y = MARGIN;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Portas", MARGIN, y);
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  comPortas.forEach((box) => {
    doc.text(`${box.nome}: ${box.portaTipo ?? "—"}`, MARGIN, y);
    y += 6;
  });
}

function addGavetasSection(doc: jsPDF, project: ProjectForPdfWithExtracted): void {
  const comGavetas = project.boxes.filter((b) => (b.gavetas ?? 0) > 0);
  if (comGavetas.length === 0) return;
  doc.addPage("a4", "portrait");
  let y = MARGIN;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Gavetas", MARGIN, y);
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  comGavetas.forEach((box) => {
    doc.text(`${box.nome}: ${box.gavetas ?? 0} gaveta(s)`, MARGIN, y);
    y += 6;
  });
}

function addFerragensSection(doc: jsPDF, project: ProjectForPdfWithExtracted): void {
  const lista = ferragensFromBoxes(project.boxes, project.rules);
  if (lista.length === 0) return;
  doc.addPage("a4", "portrait");
  let y = MARGIN;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Ferragens Industriais (todas as caixas)", MARGIN, y);
  y += 10;
  const head = [["Ferragem", "Quantidade", "Preço total"]];
  const body = lista.map((a) => [
    a.nome,
    String(a.quantidade),
    a.precoTotal != null ? `€ ${a.precoTotal.toFixed(2)}` : "—",
  ]);
  autoTable(doc, {
    head,
    body,
    startY: y,
    styles: { fontSize: 9 },
    headStyles: { fillColor: HEADER_COLOR },
    margin: { left: MARGIN, right: MARGIN },
  });
}

function addFerragensDetalhadoSection(doc: jsPDF, project: ProjectForPdfWithExtracted): void {
  const head = [["Caixa", "Ferragem", "Quantidade", "Preço total"]];
  const body: string[][] = [];
  for (const box of project.boxes) {
    const lista = ferragensFromBoxes([box], project.rules);
    for (const a of lista) {
      body.push([
        box.nome ?? box.id,
        a.nome,
        String(a.quantidade),
        a.precoTotal != null ? `€ ${a.precoTotal.toFixed(2)}` : "—",
      ]);
    }
  }
  if (body.length === 0) return;
  doc.addPage("a4", "portrait");
  let y = MARGIN;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Ferragens Industriais (detalhado)", MARGIN, y);
  y += 10;
  autoTable(doc, {
    head,
    body,
    startY: y,
    styles: { fontSize: 8 },
    headStyles: { fillColor: HEADER_COLOR },
    margin: { left: MARGIN, right: MARGIN },
  });
}

function addTotaisEResumoSection(doc: jsPDF, project: ProjectForPdfWithExtracted): void {
  doc.addPage("a4", "portrait");
  let y = MARGIN;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Totais do Projeto", MARGIN, y);
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const cutlist = cutlistComPrecoFromBoxes(project.boxes, project.rules, project.materialId);
  const extracted = (project.extractedPartsByBoxId ?? {});
  const extractedList = project.boxes.flatMap((b) =>
    Object.values(extracted[b.id] ?? {}).flat()
  );
  const totalPecas = cutlist.reduce((s, i) => s + i.quantidade, 0)
    + extractedList.reduce((s, i) => s + i.quantidade, 0);
  doc.text(`Caixas: ${project.boxes.length}`, MARGIN, y);
  y += 6;
  doc.text(`Total de peças (cutlist): ${totalPecas}`, MARGIN, y);
  y += 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Resumo Financeiro", MARGIN, y);
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const allCutlist = [...cutlist, ...extractedList];
  const totalPecasPreco =
    allCutlist.length > 0 ? calcularPrecoTotalPecas(allCutlist) : 0;
  const ferragens = ferragensFromBoxes(project.boxes, project.rules);
  const totalFerragensPreco = ferragens.reduce((s, a) => s + (a.precoTotal ?? 0), 0);
  const baseTotal = totalPecasPreco + totalFerragensPreco;
  const totalProjeto = baseTotal > 0 ? calcularPrecoTotalProjeto(baseTotal) : 0;
  doc.text(`Total peças: € ${totalPecasPreco.toFixed(2)}`, MARGIN, y);
  y += 6;
  doc.text(`Total ferragens: € ${totalFerragensPreco.toFixed(2)}`, MARGIN, y);
  y += 6;
  doc.text(`Total projeto (c/ margem): € ${totalProjeto.toFixed(2)}`, MARGIN, y);
}

/**
 * Gera PDF unificado: Técnico + Cutlist + Painéis + Portas (se existir) + Gavetas (se existir)
 * + Ferragens Industriais + Totais e Resumo Financeiro.
 */
export function buildUnifiedPdf(project: ProjectForPdfWithExtracted): jsPDF {
  const doc = buildTechnicalPdf(project);
  buildCutlistPdf(project, doc);
  addPainéisSection(doc, project);
  addPortasSection(doc, project);
  addGavetasSection(doc, project);
  addFerragensSection(doc, project);
  addFerragensDetalhadoSection(doc, project);
  addTotaisEResumoSection(doc, project);
  return doc;
}
