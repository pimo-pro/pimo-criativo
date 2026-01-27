import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { BoxModule } from "../types";
import { gerarModeloIndustrial } from "../manufacturing/boxManufacturing";

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

export function gerarPdfIndustrial(boxes: BoxModule[]) {
  const doc = new jsPDF();

  boxes.forEach((box, index) => {
    const modelo = gerarModeloIndustrial(box);
    if (index > 0) doc.addPage();

    doc.setFontSize(16);
    doc.text("PIMO Studio - Cutlist Industrial", 14, 15);
    doc.setFontSize(13);
    doc.text(box.nome || `Caixa ${index + 1}`, 14, 24);

    let cursorY = 30;

    addSectionTitle(doc, "Resumo Industrial", cursorY);
    cursorY += 6;

    const totalPecas =
      modelo.paineis.reduce((sum, item) => sum + item.quantidade, 0) +
      modelo.portas.length +
      modelo.gavetas.length;
    const totalFerragens = modelo.ferragens.reduce(
      (sum, item) => sum + item.quantidade,
      0
    );

    autoTable(doc, {
      head: [[
        "Material",
        "Área total",
        "Total peças",
        "Total ferragens",
        "Custo painéis",
        "Custo portas",
        "Custo gavetas",
        "Custo ferragens",
        "Custo total",
      ]],
      body: [[
        box.material ?? "MDF Branco",
        formatArea(modelo.cutlist.areaTotal_mm2),
        totalPecas,
        totalFerragens,
        formatCurrency(modelo.custoTotalPaineis),
        formatCurrency(modelo.custoTotalPortas),
        formatCurrency(modelo.custoTotalGavetas),
        formatCurrency(modelo.custoTotalFerragens),
        formatCurrency(modelo.custoTotal),
      ]],
      startY: cursorY,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [15, 23, 42] },
    });

    cursorY = getLastY(doc, cursorY);

    addSectionTitle(doc, "Lista de Painéis", cursorY);
    autoTable(doc, {
      head: [[
        "Tipo",
        "Largura (mm)",
        "Altura (mm)",
        "Espessura (mm)",
        "Material",
        "Orientação",
        "Qtd",
        "Custo (€)",
      ]],
      body: modelo.paineis.map((painel) => [
        painel.tipo,
        painel.largura_mm,
        painel.altura_mm,
        painel.espessura_mm,
        painel.material,
        painel.orientacaoFibra,
        painel.quantidade,
        formatCurrency(painel.custo),
      ]),
      startY: cursorY + 6,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [15, 23, 42] },
    });

    if (modelo.portas.length > 0) {
      cursorY = getLastY(doc, cursorY);
      addSectionTitle(doc, "Lista de Portas", cursorY);
      autoTable(doc, {
        head: [[
          "Tipo",
          "Largura (mm)",
          "Altura (mm)",
          "Espessura (mm)",
          "Nº dobradiças",
          "Custo (€)",
        ]],
        body: modelo.portas.map((porta) => [
          porta.tipo,
          porta.largura_mm,
          porta.altura_mm,
          porta.espessura_mm,
          porta.dobradicas,
          formatCurrency(porta.custo),
        ]),
        startY: cursorY + 6,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [15, 23, 42] },
      });
    }

    if (modelo.gavetas.length > 0) {
      cursorY = getLastY(doc, cursorY);
      addSectionTitle(doc, "Lista de Gavetas", cursorY);
      autoTable(doc, {
        head: [[
          "Largura (mm)",
          "Altura (mm)",
          "Profundidade (mm)",
          "Espessura (mm)",
          "Corrediças",
          "Custo (€)",
        ]],
        body: modelo.gavetas.map((gaveta) => [
          gaveta.largura_mm,
          gaveta.altura_mm,
          gaveta.profundidade_mm,
          gaveta.espessura_mm,
          gaveta.corrediças,
          formatCurrency(gaveta.custo),
        ]),
        startY: cursorY + 6,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [15, 23, 42] },
      });
    }

    if (modelo.ferragens.length > 0) {
      cursorY = getLastY(doc, cursorY);
      addSectionTitle(doc, "Ferragens", cursorY);
      autoTable(doc, {
        head: [[
          "Tipo",
          "Quantidade",
          "Custo (€)",
        ]],
        body: modelo.ferragens.map((ferragem) => [
          ferragem.tipo,
          ferragem.quantidade,
          formatCurrency(ferragem.custo),
        ]),
        startY: cursorY + 6,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [15, 23, 42] },
      });
    }

    cursorY = getLastY(doc, cursorY);
    addSectionTitle(doc, "Resumo Financeiro Final", cursorY);
    autoTable(doc, {
      head: [[
        "Custo painéis",
        "Custo portas",
        "Custo gavetas",
        "Custo ferragens",
        "Custo total",
      ]],
      body: [[
        formatCurrency(modelo.custoTotalPaineis),
        formatCurrency(modelo.custoTotalPortas),
        formatCurrency(modelo.custoTotalGavetas),
        formatCurrency(modelo.custoTotalFerragens),
        formatCurrency(modelo.custoTotal),
      ]],
      startY: cursorY + 6,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [15, 23, 42] },
    });
  });

  return doc;
}
