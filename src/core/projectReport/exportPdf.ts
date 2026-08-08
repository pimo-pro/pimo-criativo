/**
 * Exportacao PDF do Relatorio Final via jsPDF + jspdf-autotable (ja no projeto).
 * Nao usa html2canvas; nao altera fluxos industriais.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { isInternalProjectId } from "@/core/projects/projectIdentity";

import { buildChartMetrics } from "./chartMetrics";
import { deriveMetricas } from "./deriveMetricas";
import { getFerragensDetalhe } from "./materiaisSync";
import { joinTextoItems } from "./migrateReport";
import type { ProjectReport, ReportTextoItem } from "./types";

function safeName(name: string): string {
  return (name || "projeto")
    .replace(/[^\w\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function reportDisplayName(report: ProjectReport): string {
  const nome = String(report.gerais.nomeProjeto ?? "").trim();
  if (nome && !isInternalProjectId(nome)) return nome;
  return "Projeto";
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(text, 14, y);
  return y + 6;
}

function ensureSpace(doc: jsPDF, y: number, need = 30): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + need > pageH - 14) {
    doc.addPage();
    return 16;
  }
  return y;
}

function itemsText(items: ReportTextoItem[] | undefined): string {
  const joined = joinTextoItems(items);
  return joined || "-";
}

export function exportProjectReportPdf(report: ProjectReport): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = 16;
  const metricas = deriveMetricas(report);

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Relatorio Final do Projeto", 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Projeto: ${reportDisplayName(report)}`, 14, y);
  y += 5;
  doc.text(`Designer: ${report.gerais.designer || "-"}`, 14, y);
  y += 5;
  doc.text(`Empresa: ${report.gerais.empresa || "-"}`, 14, y);
  y += 5;
  doc.text(`Materiais: ${report.gerais.materiaisDescricao || "-"}`, 14, y);
  y += 5;
  doc.text(
    `Execucao: ${report.gerais.dataInicioExecucao || "-"} -> ${report.gerais.dataConclusaoExecucao || "-"}`,
    14,
    y
  );
  y += 8;

  y = sectionTitle(doc, "Metricas", y);
  const metrics = buildChartMetrics(metricas);
  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: metrics.map((m) => [m.label, String(m.value)]),
    styles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });
  y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;

  y = ensureSpace(doc, y);
  y = sectionTitle(doc, "Design", y);
  autoTable(doc, {
    startY: y,
    head: [["Campo", "Valor"]],
    body: [
      ["Inicio", report.design.dataInicio || "-"],
      ["Conclusao", report.design.dataConclusao || "-"],
      ["Revisoes antes", String(report.design.revisoesAntesProducao)],
      ["Revisoes apos", String(report.design.revisoesAposProducao)],
      ["Erros", itemsText(report.design.errosDesign)],
      ["Solucoes", itemsText(report.design.solucoesAplicadas)],
      ["Melhorias propostas", itemsText(report.design.melhoriasPropostas)],
      ["Melhorias implementadas", itemsText(report.design.melhoriasImplementadas)],
    ],
    styles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });
  y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;

  y = ensureSpace(doc, y);
  y = sectionTitle(doc, "Producao", y);
  autoTable(doc, {
    startY: y,
    head: [["Campo", "Valor"]],
    body: [
      ["Operadores", String(report.producao.operadores.length)],
      ["Caixas", String(report.producao.caixas.length)],
      ["Pecas", String(report.producao.pecas.length)],
      ["Inicio", report.producao.dataInicio || "-"],
      ["Fim", report.producao.dataFim || "-"],
      ["Horas efetivas", String(report.producao.horasEfetivas)],
      ["Re-producoes", String(report.producao.reProducoes)],
      ["Erros", itemsText(report.producao.erros)],
      ["Solucoes", itemsText(report.producao.solucoesAplicadas)],
      ["Melhorias", itemsText(report.producao.melhoriasImplementadas)],
    ],
    styles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });
  y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;

  y = ensureSpace(doc, y);
  y = sectionTitle(doc, "Montagem", y);
  autoTable(doc, {
    startY: y,
    head: [["Campo", "Valor"]],
    body: [
      ["Envio", report.montagem.dataEnvio || "-"],
      ["Instaladores", String(report.montagem.instaladores.length)],
      ["Inicio", report.montagem.dataInicio || "-"],
      ["Fim", report.montagem.dataFim || "-"],
      ["Intervencoes pos", String(report.montagem.intervencoesPos)],
      ["Erros", itemsText(report.montagem.erros)],
      ["Solucoes", itemsText(report.montagem.solucoesAplicadas)],
      ["Melhorias", itemsText(report.montagem.melhoriasImplementadas)],
    ],
    styles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });
  y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;

  y = ensureSpace(doc, y, 40);
  y = sectionTitle(doc, "Materiais / ferragens", y);
  const ferragens = getFerragensDetalhe(report.financeiro);
  autoTable(doc, {
    startY: y,
    head: [["Tipo", "Qtd", "Preco unit.", "Total"]],
    body:
      ferragens.length > 0
        ? ferragens.map((m) => [
            m.tipo,
            String(m.quantidade),
            m.precoUnitario.toFixed(2),
            (m.quantidade * m.precoUnitario).toFixed(2),
          ])
        : [["-", "0", "-", "Sem linhas"]],
    styles: { fontSize: 7 },
    margin: { left: 14, right: 14 },
  });
  y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;

  y = ensureSpace(doc, y, 40);
  y = sectionTitle(doc, "Financeiro", y);
  autoTable(doc, {
    startY: y,
    head: [["Linha", "Qtd", "Preco unit.", "Total"]],
    body: report.financeiro.linhas.map((l) => [
      l.label,
      l.quantidade == null || l.quantidade === 0 ? "-" : String(l.quantidade),
      l.precoUnitario == null || l.precoUnitario === 0 ? "-" : l.precoUnitario.toFixed(2),
      l.total.toFixed(2),
    ]),
    styles: { fontSize: 7 },
    margin: { left: 14, right: 14 },
  });
  y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;

  y = ensureSpace(doc, y);
  y = sectionTitle(doc, "Notas do projeto", y);
  autoTable(doc, {
    startY: y,
    head: [["Autor", "Data", "Texto"]],
    body:
      (report.notas ?? []).length > 0
        ? report.notas.map((n) => [
            n.autor,
            n.timestamp.slice(0, 19).replace("T", " "),
            n.texto,
          ])
        : [["-", "-", "Sem notas"]],
    styles: { fontSize: 7 },
    margin: { left: 14, right: 14 },
  });
  y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;

  y = ensureSpace(doc, y);
  y = sectionTitle(doc, "Avaliacao de qualidade", y);
  const q = report.qualidade ?? { rating: 3, observacoes: [] };
  autoTable(doc, {
    startY: y,
    head: [["Campo", "Valor"]],
    body: [
      ["Rating", `${q.rating} / 5`],
      ...((q.observacoes ?? []).length
        ? q.observacoes.map((o, i) => [`Obs ${i + 1}`, o])
        : [["Observacoes", "Nenhuma"]]),
    ],
    styles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });

  const file = `Relatorio_Final_${safeName(reportDisplayName(report))}.pdf`;
  doc.save(file);
}
