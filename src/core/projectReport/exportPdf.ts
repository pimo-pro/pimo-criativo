/**
 * Exportacao PDF do Relatorio Final via jsPDF + jspdf-autotable (ja no projeto).
 * Nao usa html2canvas; nao altera fluxos industriais.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { isInternalProjectId } from "@/core/projects/projectIdentity";

import { buildChartMetrics } from "./chartMetrics";
import { deriveMetricas } from "./deriveMetricas";
import { isOfficialTotalLockedKey } from "./financeReportCalc";
import { getFerragensDetalhe } from "./materiaisSync";
import { getFerragensOverrides, origemPrecoLabel, resolveOrigemPrecoLinha } from "./financeiroFerragensEngine";
import { joinTextoItems } from "./migrateReport";
import { buildRelatorioPainelContagens } from "./relatorioPainelContagens";
import { FINANCEIRO_REPORT_LABELS, type ProjectReport, type ReportTextoItem } from "./types";

/** Garante PDF sem qtd/unit sticky em keys oficiais (anti-preço legado). */
function sanitizeFinanceiroForPdf(report: ProjectReport): ProjectReport {
  return {
    ...report,
    financeiro: {
      ...report.financeiro,
      linhas: report.financeiro.linhas.map((l) => {
        if (l.key === "chapasReais") {
          return { ...l, total: 0, quantidade: null, precoUnitario: null };
        }
        if (l.key !== "iva" && l.key !== "total" && isOfficialTotalLockedKey(l.key)) {
          return { ...l, quantidade: null, precoUnitario: null };
        }
        return l;
      }),
    },
  };
}

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

export type ExportProjectReportPdfOptions = {
  coverImageDataUrl?: string | null;
};

function imageFormatFromDataUrl(dataUrl: string): "PNG" | "JPEG" | null {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")) return "JPEG";
  return null;
}

function addCoverImage(doc: jsPDF, dataUrl: string, y: number): number {
  const fmt = imageFormatFromDataUrl(dataUrl);
  if (!fmt) return y;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - 28;
  const imgH = (maxW * 9) / 16;
  try {
    doc.addImage(dataUrl, fmt, 14, y, maxW, imgH, undefined, "FAST");
    return y + imgH + 8;
  } catch {
    return y;
  }
}

/** Constrói o documento PDF preenchido, sem gravar nem devolver bytes. */
function buildReportPdfDocument(
  reportInput: ProjectReport,
  options?: ExportProjectReportPdfOptions
): jsPDF {
  const report = sanitizeFinanceiroForPdf(reportInput);
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

  const cover = String(options?.coverImageDataUrl ?? "").trim();
  if (cover.startsWith("data:image/")) {
    y = ensureSpace(doc, y, 70);
    y = addCoverImage(doc, cover, y);
  }

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
  y = sectionTitle(doc, "Painel grafico (resumo visual)", y);
  const contagens = report.painelContagens ?? buildRelatorioPainelContagens(report);
  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: [
      ["Modulos", String(contagens.modulos)],
      ["Pecas", String(contagens.pecas)],
      ["Portas", String(contagens.portas)],
      ["Gavetas", String(contagens.gavetas)],
    ],
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
      ["Melhorias propostas", itemsText(report.producao.melhoriasPropostas)],
      ["Melhorias implementadas", itemsText(report.producao.melhoriasImplementadas)],
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
      ["Melhorias propostas", itemsText(report.montagem.melhoriasPropostas)],
      ["Melhorias implementadas", itemsText(report.montagem.melhoriasImplementadas)],
    ],
    styles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });
  y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;

  y = ensureSpace(doc, y, 40);
  y = sectionTitle(doc, "4. Financeiro (custos dinâmicos)", y);
  const hasOv = Boolean(
    report.financeiro.lineOverrides &&
      Object.keys(report.financeiro.lineOverrides).length > 0
  );
  if (hasOv && report.financeiro.officialSnapshot?.totalProjeto != null) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(
      `Overrides activos — total oficial SSOT: ${Number(report.financeiro.officialSnapshot.totalProjeto).toFixed(2)} EUR`,
      14,
      y
    );
    y += 5;
  }
  autoTable(doc, {
    startY: y,
    head: [["Linha", "Qtd", "Preco unit.", "Total", "Nota"]],
    body: report.financeiro.linhas
      .filter((l) => l.key !== "chapasReais")
      .map((l) => {
        const key = l.key;
        const isOv =
          key !== "iva" &&
          key !== "total" &&
          report.financeiro.lineOverrides != null &&
          Object.prototype.hasOwnProperty.call(report.financeiro.lineOverrides, key);
        const official =
          key !== "iva" && key !== "total"
            ? report.financeiro.officialSnapshot?.[key as keyof typeof report.financeiro.officialSnapshot]
            : undefined;
        return [
          l.key in FINANCEIRO_REPORT_LABELS
            ? FINANCEIRO_REPORT_LABELS[l.key as keyof typeof FINANCEIRO_REPORT_LABELS]
            : l.label,
          l.quantidade == null || l.quantidade === 0 ? "-" : String(l.quantidade),
          l.precoUnitario == null || l.precoUnitario === 0 ? "-" : l.precoUnitario.toFixed(2),
          l.total.toFixed(2),
          isOv
            ? `override (oficial ${typeof official === "number" ? official.toFixed(2) : "-"})`
            : key === "iva" || key === "total"
              ? "-"
              : "SSOT",
        ];
      }),
    styles: { fontSize: 7 },
    margin: { left: 14, right: 14 },
  });
  y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;

  // Ferragens (detalhe) — dentro do Financeiro, sem secção Materiais separada
  const ferragens = getFerragensDetalhe(report.financeiro);
  const ferragensOv = getFerragensOverrides(report.financeiro);
  if (ferragens.length > 0) {
    y = ensureSpace(doc, y, 30);
    y = sectionTitle(doc, "Ferragens", y);
    autoTable(doc, {
      startY: y,
      head: [["Tipo", "Qtd", "Preco unit.", "Observacoes", "Total", "Nota"]],
      body: ferragens.map((m) => {
        const origem = resolveOrigemPrecoLinha(m, ferragensOv);
        const isOv = origem === "override" || origem === "manual";
        const officialUnit = ferragensOv[m.id]?.precoUnitario;
        return [
          m.tipo,
          String(m.quantidade),
          m.precoUnitario.toFixed(2),
          m.dimensoes || "-",
          (Number(m.total) || m.quantidade * m.precoUnitario).toFixed(2),
          isOv
            ? `override (${origemPrecoLabel(origem)}${
                typeof officialUnit === "number" ? `; unit ${officialUnit.toFixed(2)}` : ""
              })`
            : origemPrecoLabel(origem),
        ];
      }),
      styles: { fontSize: 7 },
      margin: { left: 14, right: 14 },
    });
    y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;
  }

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

  return doc;
}

export function exportProjectReportPdf(
  reportInput: ProjectReport,
  options?: ExportProjectReportPdfOptions
): void {
  const doc = buildReportPdfDocument(reportInput, options);
  const file = `Relatorio_Final_${safeName(reportDisplayName(reportInput))}.pdf`;
  doc.save(file);
}

/** Mesmo PDF que o download, em Blob (ex.: anexo de email). */
export function exportProjectReportPdfBytes(
  reportInput: ProjectReport,
  options?: ExportProjectReportPdfOptions
): Blob {
  const doc = buildReportPdfDocument(reportInput, options);
  return doc.output("blob");
}
