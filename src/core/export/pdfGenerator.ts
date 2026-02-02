import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { BoxModule } from "../types";
import { gerarModeloIndustrial, getPieceLabel } from "../manufacturing/boxManufacturing";
import type { RulesConfig } from "../rules/rulesConfig";

const formatCurrency = (value: number) => `${value.toFixed(2)} €`;

const formatArea = (mm2: number) => `${(mm2 / 1_000_000).toFixed(3)} m²`;

const getLastY = (doc: jsPDF, fallback: number) => {
  const last = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  return last?.finalY ? last.finalY + 6 : fallback;
};

const addSectionTitle = (doc: jsPDF, title: string, y: number) => {
  doc.setFontSize(12);
  doc.text(title, 14, y);
};

/**
 * Gera PDF com todas as peças do projeto numa única sequência contínua.
 * Quebra de página apenas quando necessário (overflow natural).
 */
export function gerarPdfIndustrial(boxes: BoxModule[], rules: RulesConfig) {
  const doc = new jsPDF();
  const allBoxes = Array.isArray(boxes) ? boxes : [];

  if (allBoxes.length === 0) {
    doc.setFontSize(16);
    doc.text("PIMO Studio - Cutlist Industrial", 14, 15);
    doc.setFontSize(12);
    doc.text("Nenhuma caixa no projeto.", 14, 25);
    return doc;
  }

  // Agregar dados de todas as caixas
  const allPaineis: Array<{ caixa: string; tipo: string; largura_mm: number; altura_mm: number; espessura_mm: number; material: string; orientacaoFibra: string; quantidade: number; custo: number }> = [];
  const allPortas: Array<{ caixa: string; tipo: string; largura_mm: number; altura_mm: number; espessura_mm: number; dobradicas: number; custo: number }> = [];
  const allGavetas: Array<{ caixa: string; largura_mm: number; altura_mm: number; profundidade_mm: number; espessura_mm: number; corrediças: number; custo: number }> = [];
  const ferragensMap: Record<string, { quantidade: number; custo: number }> = {};

  let totalAreaMm2 = 0;
  let custoTotalPaineis = 0;
  let custoTotalPortas = 0;
  let custoTotalGavetas = 0;
  let custoTotalFerragens = 0;

  for (const box of allBoxes) {
    const modelo = gerarModeloIndustrial(box, rules);
    const caixaNome = box.nome || box.id;

    totalAreaMm2 += modelo.cutlist.areaTotal_mm2;
    custoTotalPaineis += modelo.custoTotalPaineis;
    custoTotalPortas += modelo.custoTotalPortas;
    custoTotalGavetas += modelo.custoTotalGavetas;
    custoTotalFerragens += modelo.custoTotalFerragens;

    modelo.paineis.forEach((p) => {
      allPaineis.push({
        caixa: caixaNome,
        tipo: getPieceLabel(p.tipo),
        largura_mm: p.largura_mm,
        altura_mm: p.altura_mm,
        espessura_mm: p.espessura_mm,
        material: p.material,
        orientacaoFibra: p.orientacaoFibra,
        quantidade: p.quantidade,
        custo: p.custo,
      });
    });

    modelo.portas.forEach((p) => {
      allPortas.push({
        caixa: caixaNome,
        tipo: p.tipo,
        largura_mm: p.largura_mm,
        altura_mm: p.altura_mm,
        espessura_mm: p.espessura_mm,
        dobradicas: p.dobradicas,
        custo: p.custo,
      });
    });

    modelo.gavetas.forEach((g) => {
      allGavetas.push({
        caixa: caixaNome,
        largura_mm: g.largura_mm,
        altura_mm: g.altura_mm,
        profundidade_mm: g.profundidade_mm,
        espessura_mm: g.espessura_mm,
        corrediças: g.corrediças,
        custo: g.custo,
      });
    });

    modelo.ferragens.forEach((f) => {
      if (!ferragensMap[f.tipo]) ferragensMap[f.tipo] = { quantidade: 0, custo: 0 };
      ferragensMap[f.tipo].quantidade += f.quantidade;
      ferragensMap[f.tipo].custo += f.custo;
    });
  }

  const custoTotal = custoTotalPaineis + custoTotalPortas + custoTotalGavetas + custoTotalFerragens;

  let cursorY = 20;

  doc.setFontSize(16);
  doc.text("PIMO Studio - Cutlist Industrial", 14, 15);
  doc.setFontSize(12);
  doc.text(`Projeto: ${allBoxes.length} caixa(s)`, 14, 24);
  cursorY = 30;

  addSectionTitle(doc, "Resumo do Projeto", cursorY);
  cursorY += 6;

  autoTable(doc, {
    head: [[
      "Área total",
      "Total painéis",
      "Total portas",
      "Total gavetas",
      "Custo painéis",
      "Custo portas",
      "Custo gavetas",
      "Custo ferragens",
      "Custo total",
    ]],
    body: [[
      formatArea(totalAreaMm2),
      allPaineis.reduce((s, p) => s + p.quantidade, 0),
      allPortas.length,
      allGavetas.length,
      formatCurrency(custoTotalPaineis),
      formatCurrency(custoTotalPortas),
      formatCurrency(custoTotalGavetas),
      formatCurrency(custoTotalFerragens),
      formatCurrency(custoTotal),
    ]],
    startY: cursorY,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 23, 42] },
  });

  cursorY = getLastY(doc, cursorY);

  addSectionTitle(doc, "Lista de Painéis", cursorY);
  autoTable(doc, {
    head: [[
      "Caixa",
      "Tipo",
      "Largura (mm)",
      "Altura (mm)",
      "Espessura (mm)",
      "Material",
      "Orientação",
      "Qtd",
      "Custo (€)",
    ]],
    body: allPaineis.map((p) => [
      p.caixa,
      p.tipo,
      p.largura_mm,
      p.altura_mm,
      p.espessura_mm,
      p.material,
      p.orientacaoFibra,
      p.quantidade,
      formatCurrency(p.custo),
    ]),
    startY: cursorY + 6,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 23, 42] },
    margin: { left: 14, right: 14 },
  });

  cursorY = getLastY(doc, cursorY);

  if (allPortas.length > 0) {
    addSectionTitle(doc, "Lista de Portas", cursorY);
    autoTable(doc, {
      head: [[
        "Caixa",
        "Tipo",
        "Largura (mm)",
        "Altura (mm)",
        "Espessura (mm)",
        "Nº dobradiças",
        "Custo (€)",
      ]],
      body: allPortas.map((p) => [
        p.caixa,
        p.tipo,
        p.largura_mm,
        p.altura_mm,
        p.espessura_mm,
        p.dobradicas,
        formatCurrency(p.custo),
      ]),
      startY: cursorY + 6,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [15, 23, 42] },
      margin: { left: 14, right: 14 },
    });
    cursorY = getLastY(doc, cursorY);
  }

  if (allGavetas.length > 0) {
    addSectionTitle(doc, "Lista de Gavetas", cursorY);
    autoTable(doc, {
      head: [[
        "Caixa",
        "Largura (mm)",
        "Altura (mm)",
        "Profundidade (mm)",
        "Espessura (mm)",
        "Corrediças",
        "Custo (€)",
      ]],
      body: allGavetas.map((g) => [
        g.caixa,
        g.largura_mm,
        g.altura_mm,
        g.profundidade_mm,
        g.espessura_mm,
        g.corrediças,
        formatCurrency(g.custo),
      ]),
      startY: cursorY + 6,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [15, 23, 42] },
      margin: { left: 14, right: 14 },
    });
    cursorY = getLastY(doc, cursorY);
  }

  if (Object.keys(ferragensMap).length > 0) {
    addSectionTitle(doc, "Ferragens", cursorY);
    autoTable(doc, {
      head: [["Tipo", "Quantidade", "Custo (€)"]],
      body: Object.entries(ferragensMap).map(([tipo, v]) => [
        tipo,
        v.quantidade,
        formatCurrency(v.custo),
      ]),
      startY: cursorY + 6,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [15, 23, 42] },
      margin: { left: 14, right: 14 },
    });
    cursorY = getLastY(doc, cursorY);
  }

  addSectionTitle(doc, "Resumo Financeiro Final", cursorY);
  autoTable(doc, {
    head: [["Custo painéis", "Custo portas", "Custo gavetas", "Custo ferragens", "Custo total"]],
    body: [[
      formatCurrency(custoTotalPaineis),
      formatCurrency(custoTotalPortas),
      formatCurrency(custoTotalGavetas),
      formatCurrency(custoTotalFerragens),
      formatCurrency(custoTotal),
    ]],
    startY: cursorY + 6,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 23, 42] },
    margin: { left: 14, right: 14 },
  });

  return doc;
}
